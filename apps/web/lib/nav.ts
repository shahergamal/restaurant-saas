import {
  BarChart3,
  CalendarCheck,
  ChefHat,
  CircleDollarSign,
  ClipboardList,
  Contact,
  LayoutGrid,
  Home,
  Package,
  PieChart,
  Settings,
  Truck,
  UsersRound,
  BookOpen,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = { href: string; key: string; icon: LucideIcon; permission: string };

// Order follows the extended reference sidebar (Food Cost screen).
export const NAV: NavItem[] = [
  { href: '/dashboard', key: 'dashboard', icon: Home, permission: 'dashboard.view' },
  { href: '/orders', key: 'orders', icon: ClipboardList, permission: 'orders.view' },
  { href: '/tables', key: 'tables', icon: LayoutGrid, permission: 'tables.view' },
  { href: '/kitchen', key: 'kitchen', icon: ChefHat, permission: 'kitchen.view' },
  { href: '/inventory', key: 'inventory', icon: Package, permission: 'inventory.view' },
  { href: '/sales', key: 'sales', icon: CircleDollarSign, permission: 'reports.view' },
  { href: '/staff', key: 'staff', icon: UsersRound, permission: 'staff.manage' },
  { href: '/reports', key: 'reports', icon: BarChart3, permission: 'reports.view' },
  { href: '/food-cost', key: 'foodCost', icon: PieChart, permission: 'food_cost.view' },
  { href: '/reservations', key: 'reservations', icon: CalendarCheck, permission: 'tables.view' },
  { href: '/customers', key: 'customers', icon: Contact, permission: 'orders.view' },
  { href: '/suppliers', key: 'suppliers', icon: Truck, permission: 'inventory.view' },
  { href: '/menu', key: 'menu', icon: BookOpen, permission: 'recipes.manage' },
  { href: '/settings', key: 'settings', icon: Settings, permission: 'settings.view' },
];
