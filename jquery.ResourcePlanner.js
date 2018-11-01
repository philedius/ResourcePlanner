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

        var settings = $.extend({
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

            }
        }, options);

        console.log('settings:\n', settings);
        if (settings.data.resources) resources = settings.data.resources;
        if (settings.data.items) items = settings.data.items;
        var setupTimeStart = performance.now();

        setupTimeline(settings);
        setupGrid(settings);
        handleOverlap();
        setDimensions(settings);

        handleWindowResize();



        console.log('Setup time: ' + (performance.now() - setupTimeStart).toFixed(2) + 'ms');
        return this;
    }

    // NOTE: When window width is resized the draggable grid needs to be reinitialized if
    // items are draggable.
    function handleWindowResize() {
        $(window).on('resize', function () {
            unitWidth = $grid.width() / timelineSubdivisions;
            $('.item').each(function () {
                $(this).css('width', $(this).data('width') * unitWidth);
                $(this).css('left', $(this).data('x') * unitWidth);
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
        $('.row-items').each(function(index, rowItem) {
            var rowId = $(rowItem).data('row-id');
            var top = $('.resource[data-row-id="' + rowId + '"]').position().top - resourceContainerTop;
            $(rowItem).css('top', top);
        });
    }

    function checkOverlapInRow(rowIndex) {
        var rowItems = $('.row-items[data-row-id="' + rowIndex + '"] .item').map(function () {
            return {
                id: $(this).data('id'),
                subRow: 0
            }
        });

        if (rowItems.length < 2) {
            // Row contains 1 or 0 items, therefore there is no need to check for collisions.
            // Height is set to 1 in case the row used to contain more items.
            changeRowHeight($('.row[data-row-id="' + rowIndex + '"]'), 1);
            return;
        }

        // TODO: Sort items that have same start date by size. Then by id.
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
                overlapping = isOverlapping(items[currentId], items[rowItems[j].id])
                if (overlapping) {
                    colliders.push(rowItems[j].id);
                }
            }

            if (colliders.length > 1) collisions.push({
                owner: currentId,
                colliders: colliders
            });
        }


        for (var i = 0; i < collisions.length; i++) {
            var owner = collisions[i].owner;
            var colliders = collisions[i].colliders;

            for (var j = 0; j < colliders.length; j++) {
                var collider = colliders[j];
                if (owner !== collider) {
                    var ownerItem = _.find(rowItems, ['id', owner]);
                    var colliderItem = _.find(rowItems, ['id', collider]);
                    if (ownerItem.subRow === colliderItem.subRow) {
                        if (colliders.indexOf(owner) > colliders.indexOf(collider)) {
                            ownerItem.subRow += 1;
                            j = -1;
                        } else {
                            colliderItem.subRow += 1;
                            j = 0;
                        }
                    }
                }
            }
        }

        var highestSubRow = 0;
        $.each(rowItems, function (index, item) {
            if (item.subRow !== 0) {
                if (item.subRow > highestSubRow) highestSubRow = item.subRow;
                var newTop = (unitHeight * item.subRow);
                $('.item[data-id="' + item.id + '"]').css('top', newTop);
            }
        });
        var heightInUnits = highestSubRow + 1;
        changeRowHeight($('.row[data-row-id="' + rowIndex + '"]'), heightInUnits);

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
        // var rowId = $row.data('row-id');
        // $('.row-items[data-row-id="' + rowId + '"]').css('height', newHeight);
    }

    function isOverlapping(a, b) {
        var aStart = a.startDate;
        var aEnd = a.endDate;
        var bStart = b.startDate;
        var bEnd = b.endDate;
        var startsSame = aStart.isSame(bStart);
        var endsSame = aEnd.isSame(bEnd);
        if (startsSame || endsSame) return true;
        if ((aStart.isAfter(bStart) || startsSame) && (aStart.isBefore(bEnd))) return true;
        if (aEnd.isAfter(bStart) && (aEnd.isBefore(bEnd) || endsSame)) return true;
        if ((aStart.isBefore(bStart)) && (aEnd.isAfter(bEnd))) return true;
        return false;
    }

    function setupTimeline(settings) {
        switch (settings.timeline.viewType) {
            case 'month':
                timelineSubdivisions = settings.timeline.viewStart.daysInMonth();
                unitWidth = $timeline.outerWidth() / timelineSubdivisions;
                $timeline.append('<div class="month">' + settings.timeline.viewStart.format('MMMM') + '</div><div class="day-container"></div>');
                var daysHTML = '';
                for (var i = 0; i < timelineSubdivisions; i++) {
                    daysHTML += '<div class="day" data-index="' + i + '" style="width: ' + unitWidth + 'px;">' + (i + 1) + '</div>';
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
        for (var i = 0; i < resources.length; i++) {
            var resource = resources[i];
            resourcesHTML += '<div class="row resource" data-row-id="' + resource.id + '">' + resource.name + '</div>';
            gridHTML += '<div class="row grid-row" data-row-id="' + resource.id + '"></div>';
        }

        $resources.append(resourcesHTML);
        $grid.append(gridHTML);

        setupItems(items);
    }

    function setDimensions(settings) {
        var scrollContainerHeight = $planner.outerHeight() - $timelineContainer.outerHeight();
        var resourceHeight = getResourceHeight();
        $scrollContainer.css('max-height', scrollContainerHeight + 'px');
        $resources.css('height', resourceHeight + 'px');
        $grid.css('height', resourceHeight + 'px');
    }

    function getResourceHeight() {
        var resourceHeight = 0;
        $('.resource').each(function () {
            resourceHeight += $(this).outerHeight();
        });
        return resourceHeight;
    }

    function buildItemHTML(item, id) {
        var timespan = item.endDate.diff(item.startDate, 'days');
        var rowIndex = $('.resource[data-row-id="' + item.responsible.id + '"]').index();
        var left = (item.startDate.date() * unitWidth) + 'px';
        var width = (timespan * unitWidth) + 'px';
        var style = 'left: ' + left + '; width: ' + width + ';';
        var itemContent = '<div class="item-content">' + item.title + '</div>'
        var html = '<div class="item" data-x="' + item.startDate.date() + '" data-y="' + rowIndex + '" data-width="' + timespan + '" data-resource-id="' + item.responsible.id + '" data-id="' + id + '" style="' + style + '">' + itemContent + '</div>';
        return html;
    }

    function setupItems(items) {
        var rowItems = {};
        for (var i = 0; i < items.length; i++) {
            var rowId = items[i].responsible.id;
            if (!rowItems[rowId]) rowItems[rowId] = [];
            var itemHTML = buildItemHTML(items[i], i);
            rowItems[rowId].push(itemHTML);
        }

        var rowItemsHTML = '';

        $.each(rowItems, function(id, array) {
            rowItemsHTML += '<div class="row-items" data-row-id="' + id + '">';
            rowItemsHTML += array.join('');
            rowItemsHTML += '</div>'
        })

        $content.append(rowItemsHTML);

        $('.item').on('click', function (e) {
            var id = $(this).data('id');
            
        });

        $('.item').on('mouseenter', function (e) {
            var id = $(this).data('id');
            $('.row.resource[data-row-id="' + $(this).data('resource-id') + '"]').addClass('highlight');
        });

        $('.item').on('mouseleave', function (e) {
            $('.row.resource').removeClass('highlight');
        });

        $('.item').draggable({
            grid: [unitWidth, unitHeight],
            stop: handleItemDragging
        })
    }

    //  TODO: Collision detection should only be done on the item container losing
    // an item and the one gaining an item.
    function handleItemDragging(event, ui) {
        handleHorizontalItemDragging(event, ui);
        handleVerticalItemDragging(event, ui);
    }

    function handleHorizontalItemDragging(event, ui) {
        // TODO: Change dates (or change data-x and use that as a comparator in collision checking instead? To be continued...)
        // Maybe both the horizontal and vertical functions should return a boolean describing whether move requires a collision check?
    }

    function handleVerticalItemDragging(event, ui) {
        console.log(event, ui);
        var yMoveDirection = ui.position.top - ui.originalPosition.top;
        var $item = $(event.target);
        var $parent = $item.parent();
        
        
        var parentTop = $parent.position().top;
        var parentBottom = parentTop + $('.resource[data-row-id="' + $parent.data('row-id') + '"]').outerHeight();
        var itemTopInParentContext = $parent.position().top + $item.position().top;
        
        if (itemTopInParentContext >= parentTop && itemTopInParentContext < parentBottom) {
            // Item is in same row.
            $item.css('top', ui.originalPosition.top);
            handleOverlap();
        }
    }

})(jQuery);