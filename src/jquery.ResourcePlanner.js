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
    let settings;

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
            palette: [
                'hsl(206, 92%, 46%)',
                'hsl(360, 67%, 51%)',
                'hsl(193, 9%, 19%)',
                'hsl(39, 97%, 71%)',
                'hsl(247, 74%, 63%)',
                'hsl(168, 100%, 36%)',
            ]
        }, options);

        console.log('settings:\n', settings);
        if (settings.data.resources) resources = settings.data.resources;
        if (settings.data.items) items = settings.data.items;
        let setupTimeStart = performance.now();

        setupTimeline(settings);
        setupGrid(settings);
        let collisionTimeStart = performance.now();
        handleOverlap();
        console.log(`Collision time: ${(performance.now() - collisionTimeStart).toFixed(2)}ms`);
        setDimensions(settings);

        handleWindowResize();

        console.log(`Setup time: ${(performance.now() - setupTimeStart).toFixed(2)}ms`);
        return this;
    }

    // NOTE: When window width is resized the draggable grid needs to be reinitialized if
    // items are draggable.
    function handleWindowResize() {
        $(window).on('resize', () => {
            unitWidth = $grid.width() / timelineSubdivisions;
            $('.item').each((index, item) => {
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
        let resourceContainerTop = $('.resources').position().top;
        $('.row-items').each((index, rowItem) => {
            let rowId = $(rowItem).data('row-id');
            let top = $(`.resource[data-row-id="${rowId}"]`).position().top - resourceContainerTop;
            $(rowItem).css('top', top);
        });
    }

    function checkOverlapInRow(rowIndex) {
        let rowItems = $(`.row-items[data-row-id="${rowIndex}"] .item`).map((index, item) => {
            return {
                id: $(item).data('id'),
                subRow: 0
            }
        });

        // TODO: Sort items that have same start date by size. Then by id.
        rowItems.sort((a, b) => {
            if (items[a.id].startDate.isBefore(items[b.id].startDate)) return -1;
            if (items[b.id].startDate.isBefore(items[a.id].startDate)) return 1;
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
                let overlapping = isOverlapping(items[currentId], items[rowItems[j].id])
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

    /**
     * Changes height of row by a certain amount of units
     * @param {jQuery object} $row 
     * @param {integer} units 
     * 
     */
    function changeRowHeight($row, units) {
        let newHeight = unitHeight * units;
        $row.css({
            'min-height': newHeight,
            'height': newHeight,
            'max-height': newHeight
        });
    }

    function isOverlapping(a, b) {
        let aStart = a.startDate;
        let aEnd = a.endDate;
        let bStart = b.startDate;
        let bEnd = b.endDate;
        let startsSame = aStart.isSame(bStart);
        let endsSame = aEnd.isSame(bEnd);
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
                unitWidth = Math.round($timeline.outerWidth() / timelineSubdivisions);
                $timeline.append(`<div class="month">${settings.timeline.viewStart.format('MMMM')}</div><div class="day-container"></div>`);
                let daysHTML = '';
                for (let i = 0; i < timelineSubdivisions; i++) {
                    daysHTML += `<div class="day" data-index="${i}" style="width: ${unitWidth}px;">${i + 1}</div>`;
                }
                $timeline.find('.day-container').append(daysHTML);
                break;

            default:
                break;
        }
    }

    function setupGrid(settings) {
        let resources = settings.data.resources;
        let items = settings.data.items;
        $grid.append('<div class="content"></div>');
        $content = $grid.find('.content');
        let resourcesHTML = '';
        let gridHTML = '';
        let rowItemsHTML = '';
        for (let i = 0; i < resources.length; i++) {
            let resource = resources[i];
            resourcesHTML += `<div class="row resource" data-row-id="${resource.id}">${resource.name}</div>`;
            gridHTML += `<div class="row grid-row" data-row-id="${resource.id}"></div>`;
            rowItemsHTML += `<div class="row-items" data-row-id="${resource.id}"></div>`;
        }

        $resources.append(resourcesHTML);
        $grid.append(gridHTML);
        $content.append(rowItemsHTML);

        setupItems(items);
    }

    function setDimensions(settings) {
        let scrollContainerHeight = $planner.outerHeight() - $timelineContainer.outerHeight();
        let resourceHeight = getResourceHeight();
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
    

    function buildItemHTML(item, id) {
        let timespan = item.endDate.diff(item.startDate, 'days');
        let rowIndex = $(`.resource[data-row-id="${item.responsible.id}"]`).index();
        let left = `${(item.startDate.date() - 1) * unitWidth}px`;
        let width = `${timespan * unitWidth}px`;
        let style = `left: ${left}; width: ${width}; background: ${settings.palette[rowIndex % settings.palette.length]}`;
        let itemContent = `<div class="item-content">${item.startDate.$D} ${item.title}</div>`
        let html = `<div class="item" data-x="${item.startDate.date() - 1}" data-y="${rowIndex}" data-width="${timespan}" data-resource-id="${item.responsible.id}" data-id="${id}" style="${style}">${itemContent}</div>`;
        return html;
    }

    function setupItems(items) {
        let rowItems = {};
        for (let i = 0; i < items.length; i++) {
            let rowId = items[i].responsible.id;
            if (!rowItems[rowId]) rowItems[rowId] = [];
            let itemHTML = buildItemHTML(items[i], i);
            rowItems[rowId].push(itemHTML);
        }

        $.each(rowItems, (id, array) => {
            $(`.row-items[data-row-id="${id}"]`).append(array.join(''));
        })

        $('.item').on('click', (e) => {
            let id = $(this).data('id');
        });

        $('.item').on('mouseenter', (e) => {
            let $target = $(e.currentTarget);
            $(`.row.resource[data-row-id="${$target.data('resource-id')}"]`).addClass('highlight');
        });

        $('.item').on('mouseleave', (e) => {
            $('.row.resource').removeClass('highlight');
        });

        $('.item').draggable({
            grid: [unitWidth, unitHeight],
            stop: handleItemDragging,
        })
    }

    function handleItemDragging(event, ui) {
        handleHorizontalItemDragging(event, ui);
        handleVerticalItemDragging(event, ui);
    }

    function handleHorizontalItemDragging(event, ui) {
        // TODO: Change dates (or change data-x and use that as a comparator in collision checking instead? To be continued...)
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
        $item.data('resource-id', $parent.data('row-id'));
        $item.css('background', settings.palette[$parent.data('row-id') % settings.palette.length]);
    }

})(jQuery);