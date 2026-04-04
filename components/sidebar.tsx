const nav: NavGroup[] = [
  {
    title: 'Dashboards',
    links: [
      { href: '/executive-dashboard', label: 'Executive Dashboard' },
      { href: '/control-tower', label: 'Control Tower' },
      { href: '/inventory-risk', label: 'Inventory Risk' },
      { href: '/freight-dashboard', label: 'Freight Dashboard' },
      { href: '/project-dashboard', label: 'Project Dashboard' },
      { href: '/traceability-dashboard', label: 'Traceability Dashboard' },
    ],
  },
  {
    title: 'Operations',
    links: [
      { href: '/inventory', label: 'Inventory Database' },
      { href: '/transactions', label: 'Inventory Transactions' },
      { href: '/serial-traceability', label: 'Serial Traceability' },
      { href: '/projects-builds', label: 'Projects / Builds' },
      { href: '/shipment-log', label: 'Shipment Log' },
      { href: '/freight-quotes', label: 'Freight Quotes' },
      { href: '/open-pos', label: 'Open POs' },
    ],
  },
  {
    title: 'Master Data',
    links: [
      { href: '/vendors', label: 'Vendors' },
      { href: '/locations', label: 'Locations' },
      { href: '/departments', label: 'Departments' },
    ],
  },
  {
    title: 'Admin',
    adminOnly: true,
    links: [
      { href: '/rootstock', label: 'Rootstock Master' },
      { href: '/users', label: 'Users' },
      { href: '/settings', label: 'Settings' },
    ],
  },
];