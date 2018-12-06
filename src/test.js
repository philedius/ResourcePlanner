var people = [];
var events = [];

generateMockData();

var rp = $('#planner').ResourcePlanner({
    timeline: {
        viewType: 'three months',
        viewStart: dayjs(),
        highlightToday: false // TODO:
    },
    data: {
        items: events
    },
    size: {
        height: 500
    }
});

function generateMockData() {
    people = [];
    events = [];
    for (var i = 0; i < 50; i++) {
        var firstName = mockData.names.first[Math.floor(Math.random() * mockData.names.first.length)];
        var lastName = mockData.names.last[Math.floor(Math.random() * mockData.names.last.length)];
        people.push({
            name: firstName + ' ' + lastName,
            id: i
        });
        // people.push({
        //     name: mockData.oilrigs[i % mockData.oilrigs.length],
        //     id: i
        // });
    }

    for (var i = 0; i < 150; i++) {
        var startDate = Math.floor(Math.random() * 90);
        var endDate = startDate + 2 + Math.ceil(Math.random() * 15);
        events.push({
            title: mockData.events[i % mockData.events.length],
            // title: mockData.wpp[i % mockData.wpp.length],
            resource: people[i % people.length],
            
            startDate: dayjs('2018/10/01').add(startDate, 'day'),
            endDate: dayjs('2018/10/01').add(endDate, 'day')
        });
    }
}