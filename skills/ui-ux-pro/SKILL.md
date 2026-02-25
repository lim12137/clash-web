# UI/UX Pro Skills

## Overview
UI/UX Pro is a comprehensive design system and skill set for creating modern, professional user interfaces with a focus on SaaS dashboards and applications. This skill provides a complete Vue.js-based design system with Glassmorphism styling.

## Installation
This skill was installed from GitHub using:
```bash
git clone https://github.com/wadewtwt/init-vue3.git ui-ux-pro-skills
```

## Features

### 🎨 Design System
- **Glassmorphism Design**: Modern frosted glass aesthetic with transparency and blur effects
- **Color Palette**: Professional indigo and emerald color scheme
- **Typography**: Plus Jakarta Sans font family for modern, clean typography
- **Component Library**: Pre-built Vue.js components (Button, Card, etc.)

### 🛠️ Technology Stack
- Vue 3 with Composition API
- TypeScript for type safety
- Tailwind CSS v3 for styling
- Vite for fast development
- Pinia for state management
- Vue Router for navigation

### 📐 Design Specifications

#### Color Palette
- Primary: `#6366F1` (Indigo)
- Secondary: `#818CF8` 
- CTA/Accent: `#10B981` (Emerald)
- Background: `#F5F3FF`
- Text: `#1E1B4B`

#### Typography
- Font: Plus Jakarta Sans (Google Fonts)
- Weights: 300, 400, 500, 600, 700
- Mood: Friendly, modern, SaaS, clean, approachable, professional

#### Spacing System
- Extra Small: `4px` / `0.25rem`
- Small: `8px` / `0.5rem`
- Medium: `16px` / `1rem` (standard)
- Large: `24px` / `1.5rem`
- Extra Large: `32px` / `2rem`
- 2XL: `48px` / `3rem`
- 3XL: `64px` / `4rem`

### 🧩 Components

#### Button Components
```vue
<Button variant="primary">Primary Action</Button>
<Button variant="secondary">Secondary Action</Button>
```

#### Card Components
```vue
<Card>
  <h3>Card Title</h3>
  <p>Card content with glassmorphism effect</p>
</Card>
```

### 📱 Responsive Design
The design system is fully responsive with breakpoints:
- Mobile: 375px
- Tablet: 768px
- Desktop: 1024px
- Large Desktop: 1440px

## Usage

### Development
```bash
cd skills/ui-ux-pro
npm install
npm run dev
```

### Production Build
```bash
npm run build
```

### Integration
To integrate UI/UX Pro components into your projects:

1. Import the design system styles
2. Use the provided Vue components
3. Follow the design specifications in `design-system/modern-saas-dashboard/MASTER.md`

## Best Practices

### ✅ Follow These Rules
- Use consistent spacing from the defined system
- Maintain color palette consistency
- Apply glassmorphism effects appropriately
- Ensure 4.5:1 minimum contrast ratio
- Use smooth transitions (150-300ms)
- Implement visible focus states
- Respect `prefers-reduced-motion`

### ❌ Avoid These Anti-Patterns
- Excessive animation
- Dark mode by default
- Emojis as icons (use SVG instead)
- Missing cursor:pointer on clickable elements
- Layout-shifting hovers
- Low contrast text
- Instant state changes
- Invisible focus states

## File Structure
```
skills/ui-ux-pro/
├── design-system/modern-saas-dashboard/  # Design specifications
├── src/components/ui/                     # UI components
├── src/layouts/                           # Layout templates
├── src/views/                             # Page templates
└── public/                                # Static assets
```

## Design Guidelines

The UI/UX Pro skill follows a "Hero + Features + CTA" page pattern:
1. Hero section with clear value proposition
2. Features section highlighting key benefits
3. Call-to-action prominently placed above the fold

## Accessibility
- WCAG 2.1 AA compliant color contrasts
- Keyboard navigation support
- Screen reader friendly markup
- Focus management for modals and interactions

## Browser Support
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## License
MIT License - see the original repository for details.
