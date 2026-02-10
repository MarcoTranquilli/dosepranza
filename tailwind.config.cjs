module.exports = {
  content: [
    './index.html',
    './login/**/*.html',
    './reports/**/*.html',
    './app.js'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', 'sans-serif'],
        display: ['Fraunces', 'serif']
      },
      colors: {
        primary: { light: '#e8b39a', DEFAULT: '#D6804F', dark: '#c0673a', '100': '#fef4ef', '800': '#8c502f' },
        secondary: { DEFAULT: '#709460', dark: '#5a794d' },
        background: '#F3F1E7',
        'text-main': '#3B3F2F'
      }
    }
  }
};
