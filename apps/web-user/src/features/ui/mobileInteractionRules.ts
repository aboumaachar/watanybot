export const mobileInteractionRules = {
  fullWidthCards: true,
  closeReturnsToLanding: true,
  popupFocusPlacement: 'top-of-view',
  everyCtaOpensCard: true,
  menuIconRequiresTitle: true,
  menuIconRequiresEndpoint: true,
  smokeEveryMenuEndpoint: true,
  onlinePdfFallbackRequired: true,
  hybridSearchPrompt: 'hide-on-blur-and-do-not-stick'
} as const;

export default mobileInteractionRules;