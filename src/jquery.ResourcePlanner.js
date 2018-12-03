(function ($) {
    let $planner;
    let $timelineContainer;
    let $scrollContainer;
    let $corner;
    let $timeline;
    let $scrollbarFill;
    let $resources;
    let $grid;
    let $content;
    let timelineSubdivisions;
    let unitWidth;
    let unitHeight = 32;
    let resources;
    let items;
    let itemsChanged = [];
    let settings;
    let lastInnerWidth;
    let dragLeft;
    let viewStartDate;

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
            palette: [
                'hsl(206, 81%, 58%)',
                'hsl(0, 75%, 60%)',
                'hsl(193, 8%, 27%)',
                'hsl(39, 100%, 65%)',
                'hsl(247, 80%, 74%)',
                'hsl(168, 78%, 48%)',
            ]
        }, options);

        console.log('settings:\n', settings);
        if (settings.data.items) {
            items = settings.data.items;
            items.forEach(item => {
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
        let setupTimeStart = performance.now();
        setupTimeline(settings);
        setupGrid(settings);
        let collisionTimeStart = performance.now();
        handleOverlap();
        console.log(`Collision time: ${(performance.now() - collisionTimeStart).toFixed(2)}ms`);
        initializeHeight(settings);
        scaleTimelineWidth();
        handleWindowResize();

        console.log(`Setup time: ${(performance.now() - setupTimeStart).toFixed(2)}ms`);
        return this;
    }

    function extractResources() {
        let res = {};
        items.forEach(item => {
            if (!res[item.resource.id]) res[item.resource.id] = item.resource;
        });
        return res;
    }

    function handleWindowResize() {
        lastInnerWidth = window.innerWidth;
        $(window).on('resize', () => {
            if (window.innerWidth === lastInnerWidth) return;
            lastInnerWidth = window.innerWidth;
            // NOTE: Math.floor on unitWidth makes resizing jittery.
            // But this can be changed to use Math.floor again if needed.
            unitWidth = $grid.width() / timelineSubdivisions;
            $('.item').each((index, item) => {
                let id = $(item).data('id');
                $(item).css('width', items[id].state.visibleLength * unitWidth);
                if (items[id].state.x < 0) {
                    $(item).css('left', 0);
                } else {
                    $(item).css('left', items[id].state.x * unitWidth);
                }
                $(item).draggable({
                    grid: [unitWidth, unitHeight],
                    dragging: handleHorizontalItemDragging,
                    stop: handleItemDragging,
                });
                $(item).resizable({
                    minWidth: unitWidth,
                    grid: [unitWidth, unitHeight],
                    handles: 'e, w',
                    stop: handleItemResizing,
                });
            });
            scaleTimelineWidth();
        });
    }

    // Scales the width of the timeline to the unitWidth.
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
        let resourceContainerTop = $('.resources').position().top;
        $('.row-items').each((index, rowItem) => {
            let rowId = $(rowItem).data('row-id');
            let top = $(`.resource[data-row-id="${rowId}"]`).position().top - resourceContainerTop;
            $(rowItem).css('top', top);
        });
    }

    function isOverlapping(a, b) {
        let aStart = a.xPos;
        let aEnd = aStart + a.length;
        let bStart = b.xPos;
        let bEnd = bStart + b.length;
        let sameStart = aStart === bStart;
        let sameEnd = aEnd === bEnd;
        if (sameStart || sameEnd) return true;
        if ((aStart > bStart || sameStart) && aStart < bEnd) return true;
        if (aEnd > bStart && (aEnd < bEnd || sameEnd)) return true;
        if (aStart < bStart && aEnd > bEnd) return true;
    }

    function checkOverlapInRow(rowIndex) {
        let rowItems = $(`.row-items[data-row-id="${rowIndex}"] .item`).map((index, item) => {
            let itemId = $(item).data('id');
            return {
                id: itemId,
                xPos: items[itemId].state.x,
                length: items[itemId].state.length,
                subRow: 0
            }
        });
        // Sort items first by date, then by length.
        rowItems.sort((a, b) => {
            if (b.xPos > a.xPos) return -1;
            if (a.xPos > b.xPos) return 1;
            if (a.length >= b.length) return -1;
            if (b.length > a.length) return 1;
            return 0;
        });
        let collisions = [];
        for (let i = 0; i < rowItems.length; i++) {
            let currentId = rowItems[i].id;
            let colliders = [];
            for (let j = 0; j < rowItems.length; j++) {
                if (i === j) {
                    colliders.push(currentId);
                    continue;
                }
                let overlapping = isOverlapping(rowItems[i], rowItems[j])
                if (overlapping) {
                    colliders.push(rowItems[j].id);
                }
            }
            if (colliders.length > 1) collisions.push({
                owner: currentId,
                colliders: colliders
            });
        }

        for (let i = 0; i < collisions.length; i++) {
            let owner = collisions[i].owner;
            let colliders = collisions[i].colliders
            for (let j = 0; j < colliders.length; j++) {
                let collider = colliders[j];
                if (owner !== collider) {
                    let ownerItem = _.find(rowItems, ['id', owner]);
                    let colliderItem = _.find(rowItems, ['id', collider]);
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

        let highestSubRow = 0;
        $.each(rowItems, (index, item) => {
            if (item.subRow > highestSubRow) highestSubRow = item.subRow;
            let newTop = (unitHeight * item.subRow);
            $(`.item[data-id="${item.id}"]`).css('top', newTop);
        });
        let heightInUnits = highestSubRow + 1;
        changeRowHeight($(`.row[data-row-id="${rowIndex}"]`), heightInUnits);

    }

    function changeRowHeight($row, units) {
        let newHeight = unitHeight * units;
        $row.css({
            'min-height': newHeight,
            'height': newHeight,
            'max-height': newHeight
        });
    }

    function setupTimeline(settings) {
        switch (settings.timeline.viewType) {
            case 'month':
                viewStartDate = settings.timeline.viewStart.startOf('month');
                timelineSubdivisions = settings.timeline.viewStart.daysInMonth();
                break;
            case 'three months':
                viewStartDate = settings.timeline.viewStart.subtract(2, 'month').startOf('month');
                timelineSubdivisions = 90;
            default:
                break;
        }
        unitWidth = $timeline.outerWidth() / timelineSubdivisions;
        $timeline.append(`<div class="month">${settings.timeline.viewStart.format('MMMM')}</div><div class="day-container"></div>`);
        let daysHTML = '';
        for (let i = 0; i < timelineSubdivisions; i++) {
            daysHTML += `<div class="day" data-index="${i}" style="width: ${unitWidth}px;">${i + 1}</div>`;
        }
        $timeline.find('.day-container').append(daysHTML);
        $('.day').css('width', unitWidth);
        $('.month').css('width', unitWidth * timelineSubdivisions);
    }

    function setupGrid(settings) {
        $grid.append('<div class="content"></div>');
        $content = $grid.find('.content');
        let resourcesHTML = '';
        let gridHTML = '';
        let rowItemsHTML = '';
        
        $.each(resources, (id, resource) => {
            resourcesHTML += `<div class="row resource" data-row-id="${id}">${resource.name}</div>`;
            gridHTML += `<div class="row grid-row" data-row-id="${id}"></div>`;
            rowItemsHTML += `<div class="row-items" data-row-id="${id}"></div>`;
        });

        $resources.append(resourcesHTML);
        $grid.append(gridHTML);
        $content.append(rowItemsHTML);

        setupItems(items);
    }

    function initializeHeight(settings) {
        let scrollContainerHeight = $planner.outerHeight() - $timelineContainer.outerHeight();
        let resourceHeight = getResourceHeight();
        $planner.css('height', settings.size.height);
        $scrollContainer.css('max-height', scrollContainerHeight);
        $resources.css('height', resourceHeight);
        $grid.css('height', resourceHeight);
    }

    function getResourceHeight() {
        let resourceHeight = 0;
        $('.resource').each((index, resource) => {
            resourceHeight += $(resource).outerHeight();
        });
        return resourceHeight;
    }
    
    // TODO: Change function name and split up for semantics
    function buildItemHTML(item, id) {
        let length = item.endDate.diff(item.startDate, 'days');
        let visibleLength = length;
        let y = $(`.resource[data-row-id="${item.resource.id}"]`).index();
        let x = item.startDate.diff(viewStartDate, 'days');
        let left = `${x * unitWidth}px`;
        let pxLength = `${length * unitWidth}px`;
        let contentStyle = `background: ${settings.palette[y % settings.palette.length]};`
        let itemContent = `<div class="item-content" style="${contentStyle}">${item.title}</div>`;
        let classes = 'item';
        if (x < 0) {
            visibleLength = x + length > 0 ? x + length : 0;
            if (visibleLength === 0) {
                console.log(item.endDate.format('MM'));
                return '';
            }
            left = 0;
            pxLength = `${visibleLength * unitWidth}px`;
            classes += ' out-of-bounds-left';
            itemContent = `<div class="item-content" style="${contentStyle}"><span class="emoji out-of-bounds-left-emoji">👈</span>${item.title}</div>`;
        }
        if ((x + length) > timelineSubdivisions) {
            visibleLength = timelineSubdivisions - x;
            pxLength = `${visibleLength * unitWidth}px`;
            classes += ' out-of-bounds-right';
            itemContent = `<div class="item-content" style="${contentStyle}"><span class="emoji out-of-bounds-right-emoji">👉</span>${item.title}</div>`;
        }
        item.state.length = length;
        item.state.visibleLength = visibleLength;
        item.state.x = x;
        item.state.y = y;
        item.state.resourceId = item.resource.id;
        let style = `left: ${left}; width: ${pxLength}; height: ${unitHeight}px;`;
        // let html = `<div class="${classes}" data-x="${item.startDate.date() - 1}" data-y="${y}" data-length="${length}" data-visible-length=${visibleLength} data-resource-id="${item.resource.id}" data-id="${id}" style="${style}">${itemContent}</div>`;
        let html = `<div class="${classes}" data-id="${id}" style="${style}">${itemContent}</div>`;
        return html;
    }

    function setupItems(items) {
        let rowItems = {};
        for (let i = 0; i < items.length; i++) {
            let rowId = items[i].resource.id;
            if (!rowItems[rowId]) rowItems[rowId] = [];
            let itemHTML = buildItemHTML(items[i], i);
            rowItems[rowId].push(itemHTML);
        }

        $.each(rowItems, (id, array) => {
            $(`.row-items[data-row-id="${id}"]`).append(array.join(''));
        })

        $('.item').on('click', (e) => {
            let $item = $(e.currentTarget)
            let id = $item.data('id');
            let item = items[id];
            console.log('click', item);
        });

        $('.item').on('dblclick', (e) => {
            let $item = $(e.currentTarget)
            let id = $item.data('id');
            let item = items[id];
            console.log('dblclick', item);
        });

        $('.item').on('mouseenter', (e) => {
            let $item = $(e.currentTarget);
            let id = $item.data('id');
            let item = items[id];
            //console.log('mouseenter', item);
        });

        $('.item').on('mouseleave', (e) => {
            let $item = $(e.currentTarget);
            let id = $item.data('id');
            let item = items[id];
            //console.log('mouseleave', item);
        });

        $('.item').draggable({
            grid: [unitWidth, unitHeight],
            drag: handleHorizontalItemDragging,
            stop: handleItemDragging,
        });

        $('.item').resizable({
            minWidth: unitWidth,
            grid: [unitWidth, unitHeight],
            handles: 'e, w',
            stop: handleItemResizing,
        });
    }
    
    function handleItemDragging(event, ui) {
        handleHorizontalItemDragging(event, ui);
        handleVerticalItemDragging(event, ui);
    }

    function handleHorizontalItemDragging(event, ui) {
        let $item = $(event.target);
        let id = $item.data('id');
        let moveOffset = ((ui.originalPosition.left - ui.position.left) / unitWidth) * -1;
        let newXPos = items[id].state.x + moveOffset;

        if (event.type === 'drag') {
            items[id].state.lastXPos = newXPos;
            if (items[id].state.lastDroppedXPos < 0) ui.position.left += items[id].state.lastDroppedXPos * unitWidth;
            let newEndPos = newXPos + items[id].state.length;
            let outOfBoundsLeft = newXPos < 0;
            let outOfBoundsRight = newEndPos > timelineSubdivisions;
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
    }

    // Find appropriate row-items container for the item and move the item to that container.
    // Then check for collisions in original container the item was in and the new container.
    function handleVerticalItemDragging(event, ui) {
        let $item = $(event.target);
        let $parent = $item.parent();
        let parentTop = $parent.position().top;
        let parentBottom = parentTop + $(`.resource[data-row-id="${$parent.data('row-id')}"]`).outerHeight();
        let itemTopInParentContext = $parent.position().top + $item.position().top;
        if (itemTopInParentContext >= parentTop && itemTopInParentContext < parentBottom) {
            // Item is still in parent row
            $item.css('top', ui.originalPosition.top);
            handleOverlap($parent.index());
        } else if (itemTopInParentContext >= parentBottom) {
            // Item is in a row below parent
            let $newParent = findNewParent(itemTopInParentContext, $parent.data('row-id'), 1);
            setParent($item, $newParent);
            $item.css('top', 0);
            handleOverlap($parent.index());
            handleOverlap($newParent.index());
        } else if (itemTopInParentContext < parentTop) { 
            // Item is in a row above parent
            let $newParent = findNewParent(itemTopInParentContext, $parent.data('row-id'), -1);
            setParent($item, $newParent);
            $item.css('top', 0);
            handleOverlap($parent.index());
            handleOverlap($newParent.index());
        }
    }

    function handleItemResizing(event, ui) {
        let $item = $(event.target);
        let id = $item.data('id');
        let $parent = $item.parent();
        let moveOffset = (ui.position.left - ui.originalPosition.left) / unitWidth;
        let widthChange = (ui.size.width - ui.originalSize.width) / unitWidth;
        let newXPos = items[id].state.x + moveOffset;
        let newLength = Math.round(items[id].state.length + widthChange);
        let newVisibleLength = Math.round(items[id].state.visibleLength + widthChange);
        items[id].state.x = newXPos;
        items[id].state.length = newLength;
        items[id].state.visibleLength = newVisibleLength;
        handleOverlap($parent.index());
    }

    // Recursively find new parent based on item position. Start by checking closest parent in the
    // direction that the item was moved. Then checks the next and so and and so forth, until the 
    // correct parent is found.
    function findNewParent(itemTop, parentId, direction) {
        let candidateId = parentId + direction;
        let $candidate = $(`.row-items[data-row-id="${candidateId}"]`);
        let candidateTop = $candidate.position().top;
        let candidateBottom = candidateTop + $(`.resource[data-row-id="${candidateId}"]`).outerHeight();
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