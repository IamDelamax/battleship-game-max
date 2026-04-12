# Battleship Game

A fully-featured, web-based Battleship game built with React, TypeScript, and Tailwind CSS. Play against an intelligent AI opponent with multiple difficulty levels, sound effects, and persistent game statistics.

## Features

### Core Gameplay
- **Classic Battleship Rules**: 10x10 grid with standard fleet (Carrier, Battleship, Cruiser, Submarine, Destroyer)
- **Smart AI Opponent**: Three difficulty levels (Easy, Medium, Hard) with advanced targeting strategies
- **Ship Placement**: Manual placement with undo/reset options or random placement
- **Turn-based Combat**: Strategic naval warfare with visual feedback

### Enhanced Features
- **Player Profiles**: Persistent statistics tracking (wins, losses, accuracy) across sessions
- **Sound Effects**: Synthesized audio for hits, misses, sinks, and game events (with mute toggle)
- **Game Timer**: Track your gameplay duration
- **Shot History Log**: Detailed record of all moves and results
- **Mobile Responsive**: Optimized for both desktop and mobile devices
- **Accessibility**: Keyboard navigation and screen reader support

### Quality Improvements
- **8 Bug Fixes**: Comprehensive debugging including ship spacing validation, dual message system, and UI enhancements
- **Error Handling**: Robust game state management and edge case handling
- **Performance**: Optimized React components and efficient rendering

## How to Play

### Setup
1. Enter your player name (optional)
2. Choose your preferred AI difficulty level
3. Select sound preferences

### Ship Placement
1. **Manual Placement**: 
   - Click to place ships with orientation toggle (horizontal/vertical)
   - Use "Undo Last Ship" to correct mistakes
   - Use "Reset All" to start over
   - Ships must have at least one cell spacing between them
2. **Random Placement**: Instantly place all ships randomly

### Combat
1. Click on enemy grid cells to attack
2. Watch for hit/miss feedback
3. AI responds automatically after your turn
4. Game ends when all ships of one side are sunk
5. Review final board layout after game ends

### Controls
- **Mouse**: Click to place ships and attack
- **Touch**: Tap on mobile devices
- **Keyboard**: Tab navigation for accessibility
- **New Game**: Always available button to restart

## Technical Details

### Technology Stack
- **Frontend**: React 18.3.1 with TypeScript
- **Build Tool**: Vite 6.0.0
- **Styling**: TailwindCSS 3.4.15
- **State Management**: React hooks and refs
- **Persistence**: localStorage for game statistics
- **Audio**: Web Audio API for synthesized sound effects

### Game Logic
- **Ship Spacing Validation**: 8-directional adjacency checking
- **AI Strategies**: 
  - Easy: Pure random targeting
  - Medium: Hunt/target mode with checkerboard pattern
  - Hard: Probability-density targeting
- **State Management**: Immutable updates with proper cleanup

### Bug Fixes Implemented
1. **Ship Spacing**: Ships cannot touch (8-directional validation)
2. **New Game Button**: Always available restart functionality
3. **Enemy Ship Identity**: Hidden until fully sunk
4. **Final Board Review**: View ship positions after game ends
5. **Dual Messages**: Separate player and AI result displays
6. **Undo/Reset**: Full placement control with undo functionality
7. **Start Game Separation**: Review placement before starting
8. **Mobile Responsiveness**: Adaptive grid sizing for small screens

## Setup and Installation

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Local Development
```bash
# Clone the repository
git clone https://github.com/IamDelamax/battleship-game-max.git
cd battleship-game-max

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Environment Variables
No environment variables required - runs completely client-side.

## Deployment

### Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Netlify
```bash
# Build and deploy
npm run build
# Upload dist/ folder to Netlify
```

### GitHub Pages
```bash
# Build and deploy to gh-pages branch
npm run build
# Deploy dist/ folder to GitHub Pages
```

## Live Demo

**Play Online**: [https://battleship-game-app-1te9hs9x.devinapps.com](https://battleship-game-app-1te9hs9x.devinapps.com)

## Bug Report & Testing

Comprehensive bug analysis and fixes are documented in the technical report. All 8 identified bugs have been resolved with thorough testing including:
- End-to-end gameplay testing
- Mobile responsiveness verification
- Accessibility compliance checking
- Performance optimization validation

## Contributing

This project was developed as a technical interview exercise demonstrating:
- React/TypeScript proficiency
- Game development expertise
- Debugging and problem-solving skills
- UI/UX design capabilities
- Production-ready code quality

## License

Private project for technical interview assessment.

---

**Developed by**: Max Sapo  
**Technical Exercise**: Battleship Game Development & Debugging  
**Completion Date**: April 2026
