export interface NavLink {
  label: string
  to: string
  badge?: string
}
export interface NavGroup {
  label: string
  badge?: string
  links: NavLink[]
  secondaryLinks?: NavLink[]
}

export const navGroups: NavGroup[] = [
  {
    label: 'Learn',
    links: [
      { label: 'Science Notes', to: '/learn/science', badge: 'All Grades' },
      { label: 'Class 6', to: '/learn/science/class-6' },
      { label: 'Class 7', to: '/learn/science/class-7' },
      { label: 'Class 8', to: '/learn/science/class-8' },
      { label: 'Class 9', to: '/learn/science/class-9' },
      { label: 'Class 10', to: '/learn/science/class-10' },
      { label: 'Class 11', to: '/learn/science/class-11' },
      { label: 'Class 12', to: '/learn/science/class-12' },
    ],
    secondaryLinks: [
      { label: 'All Classes', to: '/classes' },
      { label: 'All Subjects', to: '/subjects' },
      { label: 'General Notes', to: '/notes' },
      { label: 'Solutions', to: '/solutions' },
    ],
  },
  {
    label: 'Practice',
    links: [
      { label: 'Questions', to: '/questions' },
      { label: 'Worksheets', to: '/notes?type=Worksheet' },
      { label: 'Previous Papers', to: '/previous-papers' },
      { label: 'Mock Tests', to: '/mock-tests', badge: 'New' },
    ],
  },
  {
    label: 'NEET',
    links: [
      { label: 'NEET Biology', to: '/neet' },
      { label: 'Botany', to: '/neet/botany' },
      { label: 'Zoology', to: '/neet/zoology' },
      { label: 'NEET Notes', to: '/neet/notes' },
      { label: 'NEET Questions', to: '/neet/questions' },
      { label: 'Previous Questions', to: '/neet/previous-questions' },
      { label: 'Revision', to: '/neet/revision' },
    ],
  },
  {
    label: 'Virtual Lab',
    badge: '3D',
    links: [
      { label: '3D Lab Hub', to: '/virtual-lab', badge: 'All Labs' },
      { label: 'Microscope Simulator', to: '/virtual-lab/microscope' },
      { label: 'Plant & Animal Cells', to: '/virtual-lab/cell' },
      { label: 'DNA Double Helix', to: '/virtual-lab/dna' },
      { label: 'Stomata & Photosynthesis', to: '/virtual-lab/stomata' },
      { label: 'Flower Dissection', to: '/virtual-lab/flower' },
    ],
  },
  {
    label: 'Tools',
    links: [
      { label: 'Calculators', to: '/calculators' },
      { label: 'Unit Converter', to: '/calculators/converter' },
      { label: 'KDP Cover Maker', to: '/tools/kdp-cover-maker', badge: 'New' },
      { label: 'Image DPI Increaser', to: '/tools/dpi-increaser', badge: 'New' },
    ],
  },
]

export const topLevelLinks: NavLink[] = [
  { label: 'Home', to: '/' },
  { label: 'About', to: '/about' },
  { label: 'Resources', to: '/resources' },
  { label: 'Contact', to: '/contact' },
]
