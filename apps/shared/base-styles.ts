/** Base CSS that every app should include — theme tokens + resets + component styles */
export const BASE_STYLES = `
  :root {
    --bg: #ffffff;
    --bg-secondary: #f8f9fa;
    --bg-hover: #f1f3f4;
    --bg-active: #e8eaed;
    --text-primary: #3c4043;
    --text-secondary: #70757a;
    --text-icon: #5f6368;
    --border: #dadce0;
    --border-light: #e8eaed;
    --accent: #1a73e8;
    --accent-hover: #1765cc;
    --accent-light: #e8f0fe;
    --red: #d93025;
    --red-light: #fce8e6;
    --green: #0b8043;
    --green-light: #e6f4ea;
    --yellow: #f9ab00;
    --current-time: #ea4335;
    --shadow-sm: 0 1px 2px 0 rgba(60,64,67,.3), 0 1px 3px 1px rgba(60,64,67,.15);
    --shadow-md: 0 1px 3px 0 rgba(60,64,67,.3), 0 4px 8px 3px rgba(60,64,67,.15);
    --card-bg: #ffffff;
    --font-stack: 'Google Sans', Roboto, Arial, sans-serif;
  }

  [data-theme="dark"] {
    --bg: #1f1f1f;
    --bg-secondary: #2d2d2d;
    --bg-hover: #3c3c3c;
    --bg-active: #4a4a4a;
    --text-primary: #e8eaed;
    --text-secondary: #9aa0a6;
    --text-icon: #9aa0a6;
    --border: #3c4043;
    --border-light: #3c4043;
    --accent: #8ab4f8;
    --accent-hover: #aecbfa;
    --accent-light: #1a3a5c;
    --red: #f28b82;
    --red-light: #5c2b29;
    --green: #81c995;
    --green-light: #1e3a2c;
    --yellow: #fdd663;
    --current-time: #f28b82;
    --shadow-sm: 0 1px 3px 0 rgba(0,0,0,.5), 0 1px 2px 0 rgba(0,0,0,.3);
    --shadow-md: 0 2px 6px 2px rgba(0,0,0,.5), 0 1px 2px 0 rgba(0,0,0,.3);
    --card-bg: #2d2d2d;
  }

  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --bg: #1f1f1f;
      --bg-secondary: #2d2d2d;
      --bg-hover: #3c3c3c;
      --bg-active: #4a4a4a;
      --text-primary: #e8eaed;
      --text-secondary: #9aa0a6;
      --text-icon: #9aa0a6;
      --border: #3c4043;
      --border-light: #3c4043;
      --accent: #8ab4f8;
      --accent-hover: #aecbfa;
      --accent-light: #1a3a5c;
      --red: #f28b82;
      --red-light: #5c2b29;
      --green: #81c995;
      --green-light: #1e3a2c;
      --yellow: #fdd663;
      --current-time: #f28b82;
      --shadow-sm: 0 1px 3px 0 rgba(0,0,0,.5), 0 1px 2px 0 rgba(0,0,0,.3);
      --shadow-md: 0 2px 6px 2px rgba(0,0,0,.5), 0 1px 2px 0 rgba(0,0,0,.3);
      --card-bg: #2d2d2d;
    }
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: var(--font-stack);
    background: var(--bg);
    color: var(--text-primary);
    -webkit-font-smoothing: antialiased;
    line-height: 1.5;
  }
`;
