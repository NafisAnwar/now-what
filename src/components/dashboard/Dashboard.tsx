import React from 'react';
import NowWhatCard from './NowWhatCard';
import DailyPlanPanel from '../planning/DailyPlanPanel';
import CalendarStrip from './CalendarStrip';
import LifestyleStrip from './LifestyleStrip';
import GoalStrip from './GoalStrip';
import ActivityFeed from './ActivityFeed';
import ReviewPrompt from './ReviewPrompt';
import InAppReminderTray from '../reminders/InAppReminderTray';

export default function Dashboard() {
  return (
    <div style={{ maxWidth: '640px', margin: '0 auto' }}>
      <NowWhatCard />
      <ReviewPrompt />
      <InAppReminderTray />
      <DailyPlanPanel />
      <CalendarStrip />
      <LifestyleStrip />
      <GoalStrip />
      <ActivityFeed />
    </div>
  );
}
