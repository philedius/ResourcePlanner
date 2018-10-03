(function ($) {
    var $planner;
    var $timelineContainer;
    var $scrollContainer;
    var $corner;
    var $timeline;
    var $scrollbarFill;
    var $resources;
    var $grid;

    $.fn.ResourcePlanner = function(options) {
        this.addClass('resource-planner');
        this.append('<div class="timeline-container"><div class="corner"></div><div class="timeline"></div><div class="scrollbar-filler"></div></div>');
        this.append('<div class="scroll-container"><div class="resources"></div><div class="grid"></div></div>');
        
        $planner = this;
        $timelineContainer = this.find('.timeline-container');
        $scrollContainer = this.find('.scroll-container');
        $corner = this.find('.corner');
        $timeline = this.find('.timeline');
        $scrollbarFill = this.find('.scrollbarFill');
        $resources = this.find('.resources');
        $grid = this.find('.grid');

        var settings = $.extend({
            resizable: true,
            draggable: true,
            size: {
                height: 768
            },
            timeline: {
                type: 'month'
            },
            data: {
                resources: [],
                items: []

            }
        }, options);

        console.log(settings);
        
        applyDimensions(settings);
        setupGrid(settings);

        // $scrollContainer.scroll(function() {
        //     // $('.content').css('top', $scrollContainer.offset().top - $scrollContainer.scrollTop());
        // });

        return this; 
    }

    function setupTimeline(settings) {
        switch (settings.timeline.type) {
            case value:
                
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
            $resources.append('<div class="row resource" data-row-id="' + resources[i].id + '">' + resources[i].name + '</div>');
            $grid.append('<div class="row"></div>');
        }
        
        // $grid.find('.content').css('top', $scrollContainer.offset().top - $scrollContainer.scrollTop());
        var $content = $grid.find('.content');
        for (var i = 0; i < items.length; i++) {
            $content.append('<div class="item" data-item-id="' + i + '">' + items[i].title + '</div>');
            $content.find('.item[data-item-id="' + i + '"]').css({
                'top': $('.resource[data-row-id="' + items[i].responsible.id + '"]').index() * 32,
                'left': (items[i].startDate.date() * 32) + 'px',
            });
        }
    }

    function applyDimensions(settings) {
        
        if (settings.size.width) $planner.css('width', settings.size.width + 'px');
        if (settings.size.height) $planner.css('max-height', settings.size.height + 'px');

        $scrollContainer.css({
            'max-height': (settings.size.height - $timelineContainer.outerHeight()) + 'px'
        });
        $resources.css('height', (settings.data.resources.length * 32) + 'px');
        $grid.css('height', (settings.data.resources.length * 32) + 'px');
    }

})(jQuery);