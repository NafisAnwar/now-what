import React from 'react';
import CalendarStrip from './CalendarStrip';
import TaskList from './TaskList';
import ActivityFeed from './ActivityFeed';

export default function Dashboard() {
  return (
    <div style={{ maxWidth: '960px', margin: '0 auto' }}>
      <CalendarStrip />
      <TaskList />
      <ActivityFeed />
    </div>
  );
}
