import App from './App.js';
import './index.scss';

let app;

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    app = new App();
    window.app = app;
});