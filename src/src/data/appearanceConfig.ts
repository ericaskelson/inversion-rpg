import type { AppearanceConfig } from '../types/game';

export const appearanceConfig: AppearanceConfig = {
  builds: [
    {
      id: 'slim',
      name: 'Slim',
      description: 'A lean, slender frame. Quick and light on your feet.',
      attributes: { agility: 1, strength: -1 },
    },
    {
      id: 'average',
      name: 'Average',
      description: 'A balanced, unremarkable physique. Nothing stands out.',
    },
    {
      id: 'athletic',
      name: 'Athletic',
      description: 'A fit, well-toned body. The mark of an active lifestyle.',
      attributes: { agility: 1 },
      fate: 1,
    },
    {
      id: 'muscular',
      name: 'Muscular',
      description: 'A powerful, heavily-built frame. Strength is your advantage.',
      attributes: { strength: 2, agility: -1 },
      traits: ['intimidating'],
      fate: 1,
    },
    {
      id: 'heavy',
      name: 'Heavy',
      description: 'A large, substantial build. Hard to move, harder to stop.',
      attributes: { endurance: 1, agility: -1 },
    },
  ],

  skinTones: [
    {
      id: 'pale',
      name: 'Pale',
      description: 'Porcelain skin, rarely touched by sun.',
    },
    {
      id: 'fair',
      name: 'Fair',
      description: 'Light skin with a healthy warmth.',
    },
    {
      id: 'tan',
      name: 'Tan',
      description: 'Sun-kissed skin, the mark of outdoor life.',
    },
    {
      id: 'olive',
      name: 'Olive',
      description: 'A warm, Mediterranean complexion.',
    },
    {
      id: 'brown',
      name: 'Brown',
      description: 'Rich, earthy skin tones.',
    },
    {
      id: 'dark',
      name: 'Dark',
      description: 'Deep, dark skin with a natural sheen.',
    },
  ],

  hairColors: [
    {
      id: 'blonde',
      name: 'Blonde',
      description: 'Golden or pale yellow hair.',
    },
    {
      id: 'brown',
      name: 'Brown',
      description: 'Common brown hair in various shades.',
    },
    {
      id: 'black',
      name: 'Black',
      description: 'Jet black hair, dark as night.',
    },
    {
      id: 'red',
      name: 'Red',
      description: 'Fiery red or auburn hair.',
      traits: ['distinctive'],
    },
    {
      id: 'gray',
      name: 'Gray',
      description: 'Silver or gray hair, whether from age or nature.',
    },
    {
      id: 'white',
      name: 'White',
      description: 'Pure white hair, striking and unusual.',
      traits: ['distinctive'],
      fate: 1,
    },
    {
      id: 'bald',
      name: 'Bald',
      description: 'No hair at all, by choice or circumstance.',
    },
  ],

  // Portraits will be populated with actual images
  // Each portrait is tagged with build, skinTone, hairColor, and sex
  portraits: [
    // Sample portraits - these will be generated with nano-banana
    // The filtering system will show only portraits matching the selected attributes
    // {
    //   id: 'portrait-male-athletic-tan-brown-01',
    //   name: 'Adventurer',
    //   image: 'portraits/male-athletic-tan-brown-01.png',
    //   build: 'athletic',
    //   skinTone: 'tan',
    //   hairColor: 'brown',
    //   sex: 'male',
    // },
  ],
};
