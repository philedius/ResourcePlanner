(function ($) {
    var $planner;
    var $timelineContainer;
    var $scrollContainer;
    var $corner;
    var $timeline;
    var $scrollbarFill;
    var $resources;
    var $grid;
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
        // setDimensions(settings);
        setupGrid(settings);
        
        handleWindowResize();
        // checkOverlap(0);
        // var offset = 0;
        // $('.resource').each(function(index) {
        //     offset += checkOverlapInRow(index, offset);
        // });
        
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

    // FIXME: I'm disgustingly broken
    // check every item of a row against every other item of the same row
    function checkOverlapInRow(rowIndex, offset) {
        var items = $('.item[data-y="' + rowIndex + '"]');
        // console.log(items);
        var highestCount = 0;
        for (var i = 0; i < items.length - 1; i++) {
            var count = 0;
            for (var j = i + 1; j < items.length; j++) {
                var overlapping = isOverlapping(items[i], items[j]);
                if (overlapping) {
                    count += 1;
                    if (count > highestCount) highestCount = count;
                    $(items[i]).css('background', 'orange');
                    $(items[j]).css('background', 'red');
                    var newTopPos = parseFloat($(items[j]).css('top').replace('px', '')) + (unitHeight * (count + offset)) + 'px';
                    $(items[j]).css('top', newTopPos);
                }
            }
        }
        console.log(highestCount + 1);
        $('.row[data-row-id="' + rowIndex + '"]').css('height', ((highestCount + 1 + offset) * unitHeight) + 'px');
        return highestCount;
    }

    function isOverlapping(a, b) {
        var aStart = $(a).data('x');
        var aEnd = aStart + $(a).data('width');
        var bStart = $(b).data('x');
        var bEnd = bStart + $(b).data('width');
        if (aStart > bStart && aStart < bEnd) return true;
        if (bStart > aStart && bStart < aEnd) return true;
        if (aStart === bStart) return true;
        return false;
    }

    function setupTimeline(settings) {
        switch (settings.timeline.viewType) {
            case 'month':
                timelineSubdivisions = settings.timeline.viewStart.daysInMonth();
                unitWidth = $timeline.width() / timelineSubdivisions;
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
        
        var $content = $grid.find('.content');
        var itemsHTML = '';
        for (var i = 0; i < items.length; i++) {
           itemsHTML += setupItemHTML(items[i], i);
        }
        $content.append(itemsHTML);
    }

    function setDimensions(settings) {
        
        // if (settings.size.width) $planner.css('width', settings.size.width + 'px');
        if (settings.size.height) $planner.css('max-height', settings.size.height + 'px');

        $scrollContainer.css({
            'max-height': (settings.size.height - $timelineContainer.outerHeight()) + 'px'
        });
        $resources.css('height', (settings.data.resources.length * unitHeight) + 'px');
        $grid.css('height', (settings.data.resources.length * unitHeight) + 'px');
    }

    function setupItemHTML(item, id) {
        var timespan = item.endDate.diff(item.startDate, 'days');
        var rowIndex = $('.resource[data-row-id="' + item.responsible.id + '"]').index();
        var top = (rowIndex * unitHeight) + 'px';
        var left = (item.startDate.date() * unitWidth) + 'px';
        var width = (timespan * unitWidth) + 'px';
        var style = 'top: ' + top + '; left: ' + left + '; width: ' + width + ';';
        var html =  '<div class="item" data-x="' + item.startDate.date() + '" data-y="' + rowIndex + '" data-width="' + timespan + '" data-resource-id="' + item.responsible.id + '" data-id="' + id + '" style="' + style + '">' + item.title + '</div>';
        return html;
    }

})(jQuery);