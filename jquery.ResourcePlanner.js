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

    $.fn.ResourcePlanner = function(options) {
        var p0 = performance.now();
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
                height: 496
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
        
        setupTimeline(settings);
        setupGrid(settings);
        setDimensions(settings);
        
        handleWindowResize();
        // checkOverlap(0);
        var offset = 0;
        $('.resource').each(function(index) {
            checkOverlapInRow(index);
        });
        
        console.log('Setup time: ' + (performance.now() - p0).toFixed(2) + 'ms');
        return this; 
    }

    function handleWindowResize() {
        $(window).on('resize', function() {
            unitWidth = $grid.width() / timelineSubdivisions;
            $('.item').each(function() {
                $(this).css('width', $(this).data('width') * unitWidth);
                $(this).css('left', $(this).data('x') * unitWidth);
            });

            $('.day').css('width', unitWidth);

        });
    }



    // check every item of a row against every other item of the same row
    function checkOverlapInRow(rowIndex) {
        var items = $('.item[data-y="' + rowIndex + '"]');
        var totalOverlapping = 0;
        var highestStack = 0;
        for (var i = 0; i < items.length - 1; i++) {
            var count = 0;
            for (var j = i + 1; j < items.length; j++) {
                var overlapping = isOverlapping($(items[i]), $(items[j]));
                if (overlapping) {
                    count += 1;
                }
                if (count > 0) shiftItemsVertically($(items[j]), 1);
            }
            if (count > highestStack) highestStack = count;
            totalOverlapping += count;
        }
        if (totalOverlapping > 0) {
            console.log(totalOverlapping, highestStack);
            changeRowHeight($('.row[data-row-id="' + rowIndex + '"]'), highestStack);
            setDimensions();
        }
    }

    /**
     * Changes height of row by a certain amount of units
     * @param {jQuery object} $row 
     * @param {integer} units 
     * 
     */
    function changeRowHeight($row, units) {
        var currentHeight = parseFloat($row.css('height').replace('px', ''));
        var newHeight = Math.round(currentHeight + (unitHeight * units));
        $row.css({
            'min-height': newHeight,
            'height': newHeight,
            'max-height': newHeight
        });
    }

    /**
     * Shifts an item vertically by a certain amount of units
     * @param {jQuery object} $item 
     * @param {integer} units 
     */
    function shiftItemVertically($item, units) {
        var currentTopPosition = parseFloat($item.css('top').replace('px', ''));
        var newTopPosition = currentTopPosition + (unitHeight * units);
        $item.css('top', newTopPosition);
    }

    /**
     *  Shifts $startingItem and all items in rows below it vertically by a certain amount of units
     * @param {integer} $startingItem 
     * @param {integer} units 
     */
    function shiftItemsVertically($startingItem, units) {
        var startingRow = $startingItem.data('y') + 1;
        var lastRow = $('.resource:last').data('row-id');
        shiftItemVertically($startingItem, units)
        for (var i = startingRow; i <= lastRow; i++) {
            $('.item[data-y="' + i + '"]').each(function() {
                shiftItemVertically($(this), units);
            });
        }
    }

    /**
     * Returns true if two given items are overlapping.
     * (Essentially a 1-dimensional collision detection)
     * @param {*} $a 
     * @param {*} $b 
     */
    function isOverlapping($a, $b) {
        var aStart = $a.data('x');
        var aEnd = aStart + $a.data('width');
        var bStart = $b.data('x');
        var bEnd = bStart + $b.data('width');
        if (aStart > bStart && aStart < bEnd) return true;
        if (bStart > aStart && bStart < aEnd) return true;
        if (aStart === bStart) return true;
        return false;
    }


    function setupTimeline(settings) {
        switch (settings.timeline.viewType) {
            case 'month':
                timelineSubdivisions = settings.timeline.viewStart.daysInMonth();
                unitWidth = $timeline.outerWidth() / timelineSubdivisions;
                $timeline.append('<div class="month">' + settings.timeline.viewStart.format('MMMM') + '</div><div class="day-container"></div>');
                var daysHTML = '';
                for(var i = 0; i < timelineSubdivisions; i++) {
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
        for (var i = 0; i < resources.length; i++) {
            var resource = resources[i];
            $resources.append('<div class="row resource" data-row-id="' + resource.id + '">' + resource.name + '</div>');
            $grid.append('<div class="row grid-row" data-row-id="' + resource.id + '"></div>');
        }
        
        $content = $grid.find('.content');
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
        $('.resource').each(function() {
            resourceHeight += $(this).outerHeight();
        });
        return resourceHeight;
    }

    function buildItemHTML(item, id) {
        var timespan = item.endDate.diff(item.startDate, 'days');
        var rowIndex = $('.resource[data-row-id="' + item.responsible.id + '"]').index();
        var top = (rowIndex * unitHeight) + 'px';
        var left = (item.startDate.date() * unitWidth) + 'px';
        var width = (timespan * unitWidth) + 'px';
        var style = 'top: ' + top + '; left: ' + left + '; width: ' + width + ';';
        var itemContent = '<div class="item-content">' + item.title + '</div>'
        var html =  '<div class="item" data-x="' + item.startDate.date() + '" data-y="' + rowIndex + '" data-width="' + timespan + '" data-resource-id="' + item.responsible.id + '" data-id="' + id + '" style="' + style + '">' + itemContent + '</div>';
        return html;
    }

    function setupItems(items) {
        var itemsHTML = '';
        for (var i = 0; i < items.length; i++) {
           itemsHTML += buildItemHTML(items[i], i);
        }
        $content.append(itemsHTML);
        $('.item').on('click', function(e) {
            var id = $(this).data('id');
            console.log(items[id]);
        });

        $('.item').on('mouseenter', function(e) {
            var id = $(this).data('id');
            console.log($(this).data('resource-id'));
        });

        // $('.item').on('mouseout', function(e) {
        //     var event = e.toElement || e.relatedTarget;
        //     if (event.parentNode === this || e === this) {
        //         return;
        //     }
        // });
    }

})(jQuery);