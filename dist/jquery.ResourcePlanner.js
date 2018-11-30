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
  var itemsChanged = [];
  var settings;
  var lastInnerWidth;
  var dragLeft;

  $.fn.ResourcePlanner = function (options) {
    $planner = this;
    $planner.empty();
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
        height: 700
      },
      margin: 4,
      timeline: {
        viewType: 'month',
        viewStart: dayjs(),
        highlightToday: false // TODO:

      },
      data: {
        // resources: [],
        items: []
      },
      // palette: [
      //     'hsl(206, 78%, 51%)',
      //     'hsl(0, 67%, 56%)',
      //     'hsl(193, 6%, 27%)',
      //     'hsl(39, 97%, 68%)',
      //     'hsl(247, 74%, 67%)',
      //     'hsl(168, 76%, 43%)',
      // ]
      palette: ['hsl(206, 81%, 58%)', 'hsl(0, 75%, 60%)', 'hsl(193, 8%, 27%)', 'hsl(39, 100%, 65%)', 'hsl(247, 80%, 74%)', 'hsl(168, 78%, 48%)']
    }, options);
    console.log('settings:\n', settings);

    if (settings.data.items) {
      items = settings.data.items;
      items.forEach(function (item) {
        item.state = {
          x: 0,
          y: 0,
          length: 0,
          visibleLength: 0,
          resourceId: 0,
          lastXPos: undefined,
          lastDroppedXPos: undefined
        };
      });
      resources = extractResources();
    } else {
      console.error('Missing data for resource planner');
    }

    var setupTimeStart = performance.now();
    setupTimeline(settings);
    setupGrid(settings);
    var collisionTimeStart = performance.now();
    handleOverlap();
    console.log("Collision time: ".concat((performance.now() - collisionTimeStart).toFixed(2), "ms"));
    initializeHeight(settings);
    scaleTimelineWidth();
    handleWindowResize();
    console.log("Setup time: ".concat((performance.now() - setupTimeStart).toFixed(2), "ms"));
    return this;
  };

  function extractResources() {
    var res = {};
    items.forEach(function (item) {
      if (!res[item.resource.id]) res[item.resource.id] = item.resource;
    });
    return res;
  }

  function handleWindowResize() {
    lastInnerWidth = window.innerWidth;
    $(window).on('resize', function () {
      if (window.innerWidth === lastInnerWidth) return;
      lastInnerWidth = window.innerWidth; // NOTE: Math.floor on unitWidth makes resizing jittery.
      // But this can be changed to use Math.floor again if needed.

      unitWidth = $grid.width() / timelineSubdivisions;
      $('.item').each(function (index, item) {
        var id = $(item).data('id');
        $(item).css('width', items[id].state.visibleLength * unitWidth);
        $(item).css('left', items[id].state.x * unitWidth);
        $(item).draggable({
          grid: [unitWidth, unitHeight],
          dragging: handleHorizontalItemDragging,
          stop: handleItemDragging
        });
        $(item).resizable({
          minWidth: unitWidth,
          grid: [unitWidth, unitHeight],
          handles: 'e, w',
          stop: handleItemResizing
        });
      });
      scaleTimelineWidth();
    });
  } // Scales the width of the timeline to the unitWidth.


  function scaleTimelineWidth() {
    $('.day').css('width', unitWidth);
    $('.month').css('width', unitWidth * timelineSubdivisions);
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

  function isOverlapping(a, b) {
    var aStart = a.xPos;
    var aEnd = aStart + a.length;
    var bStart = b.xPos;
    var bEnd = bStart + b.length;
    var sameStart = aStart === bStart;
    var sameEnd = aEnd === bEnd;
    if (sameStart || sameEnd) return true;
    if ((aStart > bStart || sameStart) && aStart < bEnd) return true;
    if (aEnd > bStart && (aEnd < bEnd || sameEnd)) return true;
    if (aStart < bStart && aEnd > bEnd) return true;
  }

  function checkOverlapInRow(rowIndex) {
    var rowItems = $(".row-items[data-row-id=\"".concat(rowIndex, "\"] .item")).map(function (index, item) {
      var itemId = $(item).data('id');
      return {
        id: itemId,
        xPos: items[itemId].state.x,
        length: items[itemId].state.length,
        subRow: 0
      };
    }); // Sort items first by date, then by length.

    rowItems.sort(function (a, b) {
      if (b.xPos > a.xPos) return -1;
      if (a.xPos > b.xPos) return 1;
      if (a.length >= b.length) return -1;
      if (b.length > a.length) return 1;
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

        var overlapping = isOverlapping(rowItems[i], rowItems[j]);

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

  function changeRowHeight($row, units) {
    var newHeight = unitHeight * units;
    $row.css({
      'min-height': newHeight,
      'height': newHeight,
      'max-height': newHeight
    });
  }

  function setupTimeline(settings) {
    switch (settings.timeline.viewType) {
      case 'month':
        timelineSubdivisions = settings.timeline.viewStart.daysInMonth();
        unitWidth = $timeline.outerWidth() / timelineSubdivisions;
        $timeline.append("<div class=\"month\">".concat(settings.timeline.viewStart.format('MMMM'), "</div><div class=\"day-container\"></div>"));
        var daysHTML = '';

        for (var i = 0; i < timelineSubdivisions; i++) {
          daysHTML += "<div class=\"day\" data-index=\"".concat(i, "\" style=\"width: ").concat(unitWidth, "px;\">").concat(i + 1, "</div>");
        }

        $timeline.find('.day-container').append(daysHTML);
        $('.day').css('width', unitWidth);
        $('.month').css('width', unitWidth * timelineSubdivisions);
        break;

      default:
        break;
    }
  }

  function setupGrid(settings) {
    $grid.append('<div class="content"></div>');
    $content = $grid.find('.content');
    var resourcesHTML = '';
    var gridHTML = '';
    var rowItemsHTML = '';
    $.each(resources, function (id, resource) {
      resourcesHTML += "<div class=\"row resource\" data-row-id=\"".concat(id, "\">").concat(resource.name, "</div>");
      gridHTML += "<div class=\"row grid-row\" data-row-id=\"".concat(id, "\"></div>");
      rowItemsHTML += "<div class=\"row-items\" data-row-id=\"".concat(id, "\"></div>");
    });
    $resources.append(resourcesHTML);
    $grid.append(gridHTML);
    $content.append(rowItemsHTML);
    setupItems(items);
  }

  function initializeHeight(settings) {
    var scrollContainerHeight = $planner.outerHeight() - $timelineContainer.outerHeight();
    var resourceHeight = getResourceHeight();
    $planner.css('height', settings.size.height);
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
  } // TODO: Change function name and split up for semantics


  function buildItemHTML(item, id) {
    var length = item.endDate.diff(item.startDate, 'days');
    var visibleLength = length;
    var y = $(".resource[data-row-id=\"".concat(item.resource.id, "\"]")).index();
    var x = item.startDate.date() - 1;
    var left = "".concat((item.startDate.date() - 1) * unitWidth, "px");
    var pxLength = "".concat(length * unitWidth, "px");
    var contentStyle = "background: ".concat(settings.palette[y % settings.palette.length], ";");
    var itemContent = "<div class=\"item-content\" style=\"".concat(contentStyle, "\">").concat(item.title, "</div>");
    var classes = 'item';

    if (x + length > timelineSubdivisions) {
      visibleLength = timelineSubdivisions - x;
      pxLength = "".concat(visibleLength * unitWidth, "px");
      classes += ' out-of-bounds-right';
      itemContent = "<div class=\"item-content\" style=\"".concat(contentStyle, "\"><span class=\"emoji out-of-bounds-right-emoji\">\uD83D\uDC49</span>").concat(item.title, "</div>");
    }

    item.state.length = length;
    item.state.visibleLength = visibleLength;
    item.state.x = x;
    item.state.y = y;
    item.state.resourceId = item.resource.id;
    var style = "left: ".concat(left, "; width: ").concat(pxLength, "; height: ").concat(unitHeight, "px;"); // let html = `<div class="${classes}" data-x="${item.startDate.date() - 1}" data-y="${y}" data-length="${length}" data-visible-length=${visibleLength} data-resource-id="${item.resource.id}" data-id="${id}" style="${style}">${itemContent}</div>`;

    var html = "<div class=\"".concat(classes, "\" data-id=\"").concat(id, "\" style=\"").concat(style, "\">").concat(itemContent, "</div>");
    return html;
  }

  function setupItems(items) {
    var rowItems = {};

    for (var i = 0; i < items.length; i++) {
      var rowId = items[i].resource.id;
      if (!rowItems[rowId]) rowItems[rowId] = [];
      var itemHTML = buildItemHTML(items[i], i);
      rowItems[rowId].push(itemHTML);
    }

    $.each(rowItems, function (id, array) {
      $(".row-items[data-row-id=\"".concat(id, "\"]")).append(array.join(''));
    });
    $('.item').on('click', function (e) {
      var $item = $(e.currentTarget);
      var id = $item.data('id');
      var item = items[id];
      console.log(item.state);
    });
    $('.item').on('mouseenter', function (e) {
      var $item = $(e.currentTarget);
      var id = $item.data('id');
      var item = items[id];
      $(".row.resource[data-row-id=\"".concat(items[id].state.resourceId, "\"]")).addClass('highlight');
    });
    $('.item').on('mouseleave', function (e) {
      $('.row.resource').removeClass('highlight');
    });
    $('.item').draggable({
      grid: [unitWidth, unitHeight],
      drag: handleHorizontalItemDragging,
      stop: handleItemDragging
    });
    $('.item').resizable({
      minWidth: unitWidth,
      grid: [unitWidth, unitHeight],
      handles: 'e, w',
      stop: handleItemResizing
    });
  }

  function handleItemDragging(event, ui) {
    handleHorizontalItemDragging(event, ui);
    handleVerticalItemDragging(event, ui);
  }

  function handleHorizontalItemDragging(event, ui) {
    var $item = $(event.target);
    var id = $item.data('id');
    var moveOffset = (ui.originalPosition.left - ui.position.left) / unitWidth * -1;
    var newXPos = items[id].state.x + moveOffset;

    if (event.type === 'drag') {
      items[id].state.lastXPos = newXPos;
      if (items[id].state.lastDroppedXPos < 0) ui.position.left += items[id].state.lastDroppedXPos * unitWidth;
      var newEndPos = newXPos + items[id].state.length;
      var outOfBoundsLeft = newXPos < 0;
      var outOfBoundsRight = newEndPos > timelineSubdivisions;

      if (outOfBoundsLeft) {
        ui.position.left = 0;
        items[id].state.visibleLength = items[id].state.length + newXPos;

        if (!$item.hasClass('out-of-bounds-left')) {
          $item.addClass('out-of-bounds-left');
          $item.find('.item-content').prepend('<span class="emoji out-of-bounds-left-emoji">👈</span>');
        }
      } else if (outOfBoundsRight) {
        items[id].state.visibleLength = timelineSubdivisions - newXPos;

        if (!$item.hasClass('out-of-bounds-right')) {
          $item.addClass('out-of-bounds-right');
          $item.find('.item-content').prepend('<span class="emoji out-of-bounds-right-emoji">👉</span>');
        }
      } else {
        items[id].state.visibleLength = items[id].state.length;
        $item.removeClass('out-of-bounds-left');
        $item.removeClass('out-of-bounds-right');
        $item.find('.out-of-bounds-left-emoji').remove();
        $item.find('.out-of-bounds-right-emoji').remove();
      }

      setItemWidth($item, items[id].state.visibleLength);
    } else if (event.type === 'dragstop') {
      if ($item.hasClass('out-of-bounds-left')) {
        items[id].state.x = Math.round(items[id].state.lastXPos);
      } else {
        items[id].state.x = Math.round(items[id].state.lastXPos);
      }

      items[id].state.lastDroppedXPos = items[id].state.lastXPos;
    }
  }

  function setItemWidth($item, units) {
    $item.css('width', units * unitWidth);
  } // Find appropriate row-items container for the item and move the item to that container.
  // Then check for collisions in original container the item was in and the new container.


  function handleVerticalItemDragging(event, ui) {
    var $item = $(event.target);
    var $parent = $item.parent();
    var parentTop = $parent.position().top;
    var parentBottom = parentTop + $(".resource[data-row-id=\"".concat($parent.data('row-id'), "\"]")).outerHeight();
    var itemTopInParentContext = $parent.position().top + $item.position().top;

    if (itemTopInParentContext >= parentTop && itemTopInParentContext < parentBottom) {
      // Item is still in parent row
      $item.css('top', ui.originalPosition.top);
      handleOverlap($parent.index());
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
  }

  function handleItemResizing(event, ui) {
    var $item = $(event.target);
    var id = $item.data('id');
    var $parent = $item.parent();
    var moveOffset = (ui.position.left - ui.originalPosition.left) / unitWidth;
    var widthChange = (ui.size.width - ui.originalSize.width) / unitWidth;
    var newXPos = items[id].state.x + moveOffset;
    var newLength = Math.round(items[id].state.length + widthChange);
    var newVisibleLength = Math.round(items[id].state.visibleLength + widthChange);
    items[id].state.x = newXPos;
    items[id].state.length = newLength;
    items[id].state.visibleLength = newVisibleLength;
    handleOverlap($parent.index());
  } // Recursively find new parent based on item position. Start by checking closest parent in the
  // direction that the item was moved. Then checks the next and so and and so forth, until the 
  // correct parent is found.


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
    items[$item.data('id')].state.resourceId = $parent.data('row-id');
  }
})(jQuery);