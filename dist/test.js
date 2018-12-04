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
    height: 500
  }
});

function generateMockData() {
  people = [];
  events = [];

  for (var i = 0; i < 40; i++) {
    var firstName = mockData.names.first[Math.floor(Math.random() * mockData.names.first.length)];
    var lastName = mockData.names.last[Math.floor(Math.random() * mockData.names.last.length)];
    people.push({
      name: firstName + ' ' + lastName,
      id: i
    });
  }

  for (var i = 0; i < 200; i++) {
    var startDate = 1 + Math.floor(Math.random() * 90);
    var endDate = startDate + 4 + Math.ceil(Math.random() * 10);
    events.push({
      title: mockData.events[i % mockData.events.length],
      resource: people[i % people.length],
      startDate: dayjs('2018/10/01').add(startDate, 'day'),
      endDate: dayjs('2018/10/01').add(endDate, 'day')
    });
  }
}