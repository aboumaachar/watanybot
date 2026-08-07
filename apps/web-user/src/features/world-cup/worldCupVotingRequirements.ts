export type WorldCupVotingRule = {
  id: string;
  labelAr: string;
  scope: 'tournament' | 'match';
  trigger: 'fixture_import' | 'match_publish' | 'manual_admin';
  notificationAudience: string[];
  groupSendRequired: boolean;
};

export const worldCupVotingRequirements: WorldCupVotingRule[] = [
  {
    id: 'world-cup-champion-team-vote',
    labelAr: 'تصويت: من سيفوز بكأس العالم؟',
    scope: 'tournament',
    trigger: 'fixture_import',
    notificationAudience: ['world-cup-groups', 'registered-users'],
    groupSendRequired: true
  },
  {
    id: 'world-cup-best-player-vote',
    labelAr: 'تصويت: من سيكون نجم البطولة؟',
    scope: 'tournament',
    trigger: 'fixture_import',
    notificationAudience: ['world-cup-groups', 'registered-users'],
    groupSendRequired: true
  },
  {
    id: 'world-cup-match-winner-vote',
    labelAr: 'تصويت كل مباراة: من سيفوز؟',
    scope: 'match',
    trigger: 'match_publish',
    notificationAudience: ['world-cup-groups', 'match-followers'],
    groupSendRequired: true
  }
];

export default worldCupVotingRequirements;