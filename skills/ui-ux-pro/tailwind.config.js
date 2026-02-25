/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{vue,js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: 'var(--color-primary)',
                secondary: 'var(--color-secondary)',
                cta: 'var(--color-cta)',
                background: 'var(--color-background)',
                text: 'var(--color-text)',
            },
            fontFamily: {
                sans: ['"Plus Jakarta Sans"', 'sans-serif'],
            },
            boxShadow: {
                sm: 'var(--shadow-sm)',
                md: 'var(--shadow-md)',
                lg: 'var(--shadow-lg)',
                xl: 'var(--shadow-xl)',
            }
        },
    },
    plugins: [],
}
