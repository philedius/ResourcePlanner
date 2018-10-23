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
    var colors = ['#000000','#10031a','#28052d','#420738','#5d0a3a','#741134','#851c2a','#902a1d','#933c11','#8e510a','#856809','#797f0f','#6c941e','#62a734','#5cb650','#5bc270','#5bc270','#5bc270','#5bc270','#5bc270','#5bc270','#5bc270',]

    $.fn.ResourcePlanner = function(options) {
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
                height: 800
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

    function handleOverlap() {
        $('.resource').each(function(index) {
            checkOverlapInRow(index);
        });
        shiftItemsDown();
    }

    function checkOverlapInRow(rowIndex) {
        var rowItems = $('.item[data-y="' + rowIndex + '"]').map(function() { return { id: $(this).data('id'), subRow: 0 } });
        if (rowItems.length < 2) return;
        // TODO: Sort items that have same start date by size. Then by id.
        rowItems.sort(function(a, b) {
            if (items[a.id].startDate.isBefore(items[b.id].startDate)) return -1;
            if (items[b.id].startDate.isBefore(items[a.id].startDate)) return 1;
            return 0;
        });
        var collisions = [];
        for (var i = 0; i < rowItems.length; i++) {
            var currentId = rowItems[i].id;
            var count = 0;
            var colliders = [];
            for (var j = 0; j < rowItems.length; j++) {
                if (i === j) {
                    colliders.push(currentId);
                    continue;
                }
                overlapping = isOverlapping(items[currentId], items[rowItems[j].id])
                if (overlapping) {
                    count += 1;
                    colliders.push(rowItems[j].id);
                }
            }

            if (colliders.length > 1) collisions.push({ owner: currentId, colliders: colliders });
            $('.item[data-id="' + currentId + '"] .item-content').text(currentId + ' (' + count + ')');
            $('.item[data-id="' + currentId + '"]').css('background-color', colors[count])
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
        $.each(rowItems, function(index, item) {
            if (item.subRow !== 0) {
                if (item.subRow > highestSubRow) highestSubRow = item.subRow;
                var currentTop = $('.item[data-id="' + item.id + '"]').position().top;
                var newTop = currentTop + (unitHeight * item.subRow);
                $('.item[data-id="' + item.id + '"]').css('top', newTop + 'px');
            } else {
                var currentTop = $('.item[data-id="' + item.id + '"]').position().top; 
                console.log(currentTop, $('.row[data-row-id="' + rowIndex + '"]').position().top - $('.timeline-container').position().top);
            }
        });
        changeRowHeight($('.row[data-row-id="' + rowIndex + '"]'), highestSubRow);

    }

    function shiftItemsDown() {
        var totalOffset = 0;
        for (var i = 1; i < $('.resource').length; i++) {
            var offset = ($('.resource[data-row-id="' + (i - 1) + '"]').outerHeight() / unitHeight) - 1;
            totalOffset += offset;
            $('.item[data-y="' + i + '"]').each(function() {
                shiftItemVertically($(this), totalOffset);
            });
        }
    }

    /**
     * Changes height of row by a certain amount of units
     * @param {jQuery object} $row 
     * @param {integer} units 
     * 
     */
    function changeRowHeight($row, units) {
        // var currentHeight = parseFloat($row.css('height').replace('px', ''));
        var currentHeight = $row.outerHeight();
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
        var currentTopPosition = $item.position().top;
        var newTopPosition = (currentTopPosition + (unitHeight * units)) + 'px';
        $item.css('top', newTopPosition);
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
            checkOverlapInRow($(this).data('y'));
        });

        $('.item').on('mouseenter', function(e) {
            var id = $(this).data('id');
            $('.row.resource[data-row-id="'+items[id].responsible.id+'"]').addClass('highlight');
            console.log();
        });

        $('.item').on('mouseleave', function(e) {
            $('.row.resource').removeClass('highlight');
        });
    }

})(jQuery);