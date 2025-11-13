// tailwind.config.js
module.exports = {
	purge: [],
	darkMode: false, // or 'media' or 'class'
	theme: {
		extend: {},
	},
	variants: {
		extend: {
			colors: {
				gold: {
					DEFAULT: '#E6B422',
					light: '#F7D46F',
					dark: '#B48A12',
				},
			},
		}
	},
	plugins: [],
}
