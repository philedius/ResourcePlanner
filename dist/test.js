"use strict";

var people = [];
var events = [];
generateMockData();
var rp = $('#planner').ResourcePlanner({
  timeline: {
    viewType: 'month',
    viewStart: dayjs(),
    highlightToday: false // TODO:

  },
  data: {
    items: events
  },
  size: {
    height: 800
  }
});

function generateMockData() {
  people = [];
  events = [];

  for (var i = 0; i < 20; i++) {
    var firstName = mockData.names.first[Math.floor(Math.random() * mockData.names.first.length)];
    var lastName = mockData.names.last[Math.floor(Math.random() * mockData.names.last.length)];
    people.push({
      name: firstName + ' ' + lastName,
      id: i
    }); // people.push({
    //     name: mockData.oilrigs[i % mockData.oilrigs.length],
    //     id: i
    // });
  }

  for (var i = 0; i < 580; i++) {
    var startDate = 1 + Math.floor(Math.random() * 60);
    var endDate = startDate + 1 + Math.ceil(Math.random() * 15);
    events.push({
      title: mockData.events[i % mockData.events.length],
      // title: mockData.wpp[i % mockData.wpp.length],
      resource: people[i % people.length],
      startDate: dayjs('2018/11/01').add(startDate, 'day'),
      endDate: dayjs('2018/11/01').add(endDate, 'day')
    });
  }
}