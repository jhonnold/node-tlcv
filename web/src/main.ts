import './styles/tokens.css';
import { mount } from 'svelte';
import App from './App.svelte';
import { initTheme } from '$lib/theme/theme.svelte';

initTheme(); // apply stored/preferred theme before first render
const app = mount(App, { target: document.getElementById('app')! });
export default app;
