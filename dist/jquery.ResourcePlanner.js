"use strict";

(function ($) {
  var $planner;
  var $timelineContainer;
  var $scrollContainer;
  var $corner;
  var $timeline;
  var $scrollbarFill;
  var $resources;
  var $grid;
  var $content;
  var timelineSubdivisions;
  var unitWidth;
  var unitHeight = 32;
  var resources;
  var items;
  var settings;

  $.fn.ResourcePlanner = function (options) {
    $planner = this;
    $planner.addClass('resource-planner');
    $planner.append('<div class="timeline-container"><div class="corner"></div><div class="timeline"></div><div class="scrollbar-filler"></div></div>');
    $planner.append('<div class="scroll-container"><div class="resources"></div><div class="grid"></div></div>');
    $timelineContainer = $planner.find('.timeline-container');
    $scrollContainer = $planner.find('.scroll-container');
    $corner = $planner.find('.corner');
    $timeline = $planner.find('.timeline');
    $scrollbarFill = $planner.find('.scrollbarFill');
    $resources = $planner.find('.resources');
    $grid = $planner.find('.grid');
    settings = $.extend({
      resizable: true,
      draggable: true,
      overlap: true,
      size: {
        height: 600
      },
      timeline: {
        viewType: 'month',
        viewStart: dayjs(),
        highlightToday: false // TODO:

      },
      data: {
        resources: [],
        items: []
      },
      palette: ['hsl(206, 92%, 46%)', 'hsl(360, 67%, 51%)', 'hsl(193, 9%, 19%)', 'hsl(39, 97%, 71%)', 'hsl(247, 74%, 63%)', 'hsl(168, 100%, 36%)']
    }, options);
    console.log('settings:\n', settings);
    if (settings.data.resources) resources = settings.data.resources;
    if (settings.data.items) items = settings.data.items;
    var setupTimeStart = performance.now();
    setupTimeline(settings);
    setupGrid(settings);
    var collisionTimeStart = performance.now();
    handleOverlap();
    console.log("Collision time: ".concat((performance.now() - collisionTimeStart).toFixed(2), "ms"));
    setDimensions(settings);
    handleWindowResize();
    console.log("Setup time: ".concat((performance.now() - setupTimeStart).toFixed(2), "ms"));
    return this;
  }; // NOTE: When window width is resized the draggable grid needs to be reinitialized if
  // items are draggable.


  function handleWindowResize() {
    $(window).on('resize', function () {
      unitWidth = $grid.width() / timelineSubdivisions;
      $('.item').each(function (index, item) {
        $(item).css('width', Math.floor($(item).data('width') * unitWidth));
        $(item).css('left', Math.floor($(item).data('x') * unitWidth));
      });
      $('.day').css('width', unitWidth);
    });
  }

  function handleOverlap(rowIndex) {
    if (rowIndex) {
      checkOverlapInRow(rowIndex);
    } else {
      $('.resource').each(function (index) {
        checkOverlapInRow(index);
      });
    }

    setRowItemsPositions();
  }

  function setRowItemsPositions() {
    var resourceContainerTop = $('.resources').position().top;
    $('.row-items').each(function (index, rowItem) {
      var rowId = $(rowItem).data('row-id');
      var top = $(".resource[data-row-id=\"".concat(rowId, "\"]")).position().top - resourceContainerTop;
      $(rowItem).css('top', top);
    });
  }

  function checkOverlapInRow(rowIndex) {
    var rowItems = $(".row-items[data-row-id=\"".concat(rowIndex, "\"] .item")).map(function (index, item) {
      return {
        id: $(item).data('id'),
        subRow: 0
      };
    }); // TODO: Sort items that have same start date by size. Then by id.

    rowItems.sort(function (a, b) {
      if (items[a.id].startDate.isBefore(items[b.id].startDate)) return -1;
      if (items[b.id].startDate.isBefore(items[a.id].startDate)) return 1;
      return 0;
    });
    var collisions = [];

    for (var i = 0; i < rowItems.length; i++) {
      var currentId = rowItems[i].id;
      var colliders = [];

      for (var j = 0; j < rowItems.length; j++) {
        if (i === j) {
          colliders.push(currentId);
          continue;
        }

        var overlapping = isOverlapping(items[currentId], items[rowItems[j].id]);

        if (overlapping) {
          colliders.push(rowItems[j].id);
        }
      }

      if (colliders.length > 1) collisions.push({
        owner: currentId,
        colliders: colliders
      });
    }

    for (var _i = 0; _i < collisions.length; _i++) {
      var owner = collisions[_i].owner;
      var _colliders = collisions[_i].colliders;

      for (var _j = 0; _j < _colliders.length; _j++) {
        var collider = _colliders[_j];

        if (owner !== collider) {
          var ownerItem = _.find(rowItems, ['id', owner]);

          var colliderItem = _.find(rowItems, ['id', collider]);

          if (ownerItem.subRow === colliderItem.subRow) {
            if (_colliders.indexOf(owner) > _colliders.indexOf(collider)) {
              ownerItem.subRow += 1;
              _j = -1;
            } else {
              colliderItem.subRow += 1;
              _j = 0;
            }
          }
        }
      }
    }

    var highestSubRow = 0;
    $.each(rowItems, function (index, item) {
      if (item.subRow > highestSubRow) highestSubRow = item.subRow;
      var newTop = unitHeight * item.subRow;
      $(".item[data-id=\"".concat(item.id, "\"]")).css('top', newTop);
    });
    var heightInUnits = highestSubRow + 1;
    changeRowHeight($(".row[data-row-id=\"".concat(rowIndex, "\"]")), heightInUnits);
  }
  /**
   * Changes height of row by a certain amount of units
   * @param {jQuery object} $row 
   * @param {integer} units 
   * 
   */


  function changeRowHeight($row, units) {
    var newHeight = unitHeight * units;
    $row.css({
      'min-height': newHeight,
      'height': newHeight,
      'max-height': newHeight
    });
  }

  function isOverlapping(a, b) {
    var aStart = a.startDate;
    var aEnd = a.endDate;
    var bStart = b.startDate;
    var bEnd = b.endDate;
    var startsSame = aStart.isSame(bStart);
    var endsSame = aEnd.isSame(bEnd);
    if (startsSame || endsSame) return true;
    if ((aStart.isAfter(bStart) || startsSame) && aStart.isBefore(bEnd)) return true;
    if (aEnd.isAfter(bStart) && (aEnd.isBefore(bEnd) || endsSame)) return true;
    if (aStart.isBefore(bStart) && aEnd.isAfter(bEnd)) return true;
    return false;
  }

  function setupTimeline(settings) {
    switch (settings.timeline.viewType) {
      case 'month':
        timelineSubdivisions = settings.timeline.viewStart.daysInMonth();
        unitWidth = Math.round($timeline.outerWidth() / timelineSubdivisions);
        $timeline.append("<div class=\"month\">".concat(settings.timeline.viewStart.format('MMMM'), "</div><div class=\"day-container\"></div>"));
        var daysHTML = '';

        for (var i = 0; i < timelineSubdivisions; i++) {
          daysHTML += "<div class=\"day\" data-index=\"".concat(i, "\" style=\"width: ").concat(unitWidth, "px;\">").concat(i + 1, "</div>");
        }

        $timeline.find('.day-container').append(daysHTML);
        break;

      default:
        break;
    }
  }

  function setupGrid(settings) {
    var resources = settings.data.resources;
    var items = settings.data.items;
    $grid.append('<div class="content"></div>');
    $content = $grid.find('.content');
    var resourcesHTML = '';
    var gridHTML = '';
    var rowItemsHTML = '';

    for (var i = 0; i < resources.length; i++) {
      var resource = resources[i];
      resourcesHTML += "<div class=\"row resource\" data-row-id=\"".concat(resource.id, "\">").concat(resource.name, "</div>");
      gridHTML += "<div class=\"row grid-row\" data-row-id=\"".concat(resource.id, "\"></div>");
      rowItemsHTML += "<div class=\"row-items\" data-row-id=\"".concat(resource.id, "\"></div>");
    }

    $resources.append(resourcesHTML);
    $grid.append(gridHTML);
    $content.append(rowItemsHTML);
    setupItems(items);
  }

  function setDimensions(settings) {
    var scrollContainerHeight = $planner.outerHeight() - $timelineContainer.outerHeight();
    var resourceHeight = getResourceHeight();
    $scrollContainer.css('max-height', scrollContainerHeight);
    $resources.css('height', resourceHeight);
    $grid.css('height', resourceHeight);
  }

  function getResourceHeight() {
    var resourceHeight = 0;
    $('.resource').each(function (index, resource) {
      resourceHeight += $(resource).outerHeight();
    });
    return resourceHeight;
  }

  function buildItemHTML(item, id) {
    var timespan = item.endDate.diff(item.startDate, 'days');
    var rowIndex = $(".resource[data-row-id=\"".concat(item.responsible.id, "\"]")).index();
    var left = "".concat((item.startDate.date() - 1) * unitWidth, "px");
    var width = "".concat(timespan * unitWidth, "px");
    var style = "left: ".concat(left, "; width: ").concat(width, "; background: ").concat(settings.palette[rowIndex % settings.palette.length]);
    var itemContent = "<div class=\"item-content\">".concat(item.startDate.$D, " ").concat(item.title, "</div>");
    var html = "<div class=\"item\" data-x=\"".concat(item.startDate.date() - 1, "\" data-y=\"").concat(rowIndex, "\" data-width=\"").concat(timespan, "\" data-resource-id=\"").concat(item.responsible.id, "\" data-id=\"").concat(id, "\" style=\"").concat(style, "\">").concat(itemContent, "</div>");
    return html;
  }

  function setupItems(items) {
    var _this = this;

    var rowItems = {};

    for (var i = 0; i < items.length; i++) {
      var rowId = items[i].responsible.id;
      if (!rowItems[rowId]) rowItems[rowId] = [];
      var itemHTML = buildItemHTML(items[i], i);
      rowItems[rowId].push(itemHTML);
    } // TODO: Need to create row item containers for all rows. This doesn't include empty rows


    $.each(rowItems, function (id, array) {
      $(".row-items[data-row-id=\"".concat(id, "\"]")).append(array.join(''));
    });
    $('.item').on('click', function (e) {
      var id = $(_this).data('id');
    });
    $('.item').on('mouseenter', function (e) {
      var id = $(_this).data('id');
      $(".row.resource[data-row-id=\"".concat($(_this).data('resource-id'), "\"]")).addClass('highlight');
    });
    $('.item').on('mouseleave', function (e) {
      $('.row.resource').removeClass('highlight');
    });
    $('.item').draggable({
      grid: [unitWidth, unitHeight],
      stop: handleItemDragging
    });
  } //  TODO: Collision detection should only be done on the item container losing
  // an item and the one gaining an item.


  function handleItemDragging(event, ui) {
    handleHorizontalItemDragging(event, ui);
    handleVerticalItemDragging(event, ui);
  }

  function handleHorizontalItemDragging(event, ui) {} // TODO: Change dates (or change data-x and use that as a comparator in collision checking instead? To be continued...)
  // Find appropriate row-items container for the item and move the item to that container.
  // Then check for collisions in original container the item was in and the new container.


  function handleVerticalItemDragging(event, ui) {
    var $item = $(event.target);
    var $parent = $item.parent();
    var parentTop = $parent.position().top;
    var parentBottom = parentTop + $(".resource[data-row-id=\"".concat($parent.data('row-id'), "\"]")).outerHeight();
    var itemTopInParentContext = $parent.position().top + $item.position().top;

    if (itemTopInParentContext >= parentTop && itemTopInParentContext < parentBottom) {
      // Item still in parent row
      $item.css('top', ui.originalPosition.top);
    } else if (itemTopInParentContext >= parentBottom) {
      // Item is in a row below parent
      var $newParent = findNewParent(itemTopInParentContext, $parent.data('row-id'), 1);
      setParent($item, $newParent);
      $item.css('top', 0);
      handleOverlap($parent.index());
      handleOverlap($newParent.index());
    } else if (itemTopInParentContext < parentTop) {
      // Item is in a row above parent
      var _$newParent = findNewParent(itemTopInParentContext, $parent.data('row-id'), -1);

      setParent($item, _$newParent);
      $item.css('top', 0);
      handleOverlap($parent.index());
      handleOverlap(_$newParent.index());
    }
  } // Find new parent based on item position. Start by checking closest parent in the direction
  // that the item was moved. Then checks the next and so and and so forth, until the correct
  // parent is found.


  function findNewParent(itemTop, parentId, direction) {
    var candidateId = parentId + direction;
    var $candidate = $(".row-items[data-row-id=\"".concat(candidateId, "\"]"));
    var candidateTop = $candidate.position().top;
    var candidateBottom = candidateTop + $(".resource[data-row-id=\"".concat(candidateId, "\"]")).outerHeight();

    if (direction > 0) {
      if (candidateBottom <= itemTop) return findNewParent(itemTop, candidateId, direction);
      if (candidateBottom > itemTop && candidateTop <= itemTop) return $candidate;
    } else {
      if (candidateTop > itemTop) return findNewParent(itemTop, candidateId, direction);
      if (candidateBottom > itemTop && candidateTop <= itemTop) return $candidate;
    }
  }

  function setParent($item, $parent) {
    $parent.append($item);
    $item.css('background', settings.palette[$parent.data('row-id') % settings.palette.length]);
  }
})(jQuery);