import { Game } from './core/Game.js';

// Single entry point. Construct the Game (it builds scene/camera/renderer/systems
// internally) and start the render loop. Hot reload via Vite is automatic.
const game = new Game(document.getElementById('app'));
game.start();
