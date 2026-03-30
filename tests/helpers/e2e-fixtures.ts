import type { Page } from '@playwright/test';

function todayAt(hour: number, minute: number, second = 0) {
  const now = new Date();
  now.setHours(hour, minute, second, 0);
  return now.toISOString();
}

export const coreOrdersFixture = [
  {
    id: 'order-gabriele',
    user: 'Gabriele Maria Cirulli',
    email: 'gabrielemariacirulli@gmail.com',
    createdAt: todayAt(11, 5, 15),
    orderStatus: 'submitted',
    paymentStatus: 'pending',
    reconciled: false,
    total: 8,
    allergies: '',
    items: [
      { name: 'Riso integrale bresaola limone e rughetta', details: '', price: 4 },
      { name: 'Ovoline di bufala 150g', details: '', price: 1 },
      { name: 'Ovoline di bufala 150g', details: '', price: 1 },
      { name: 'Cicoria ripassata', details: 'Porz: 100g', price: 2 }
    ]
  },
  {
    id: 'order-lorenzo-zuaro',
    user: 'Lorenzo Zuaro',
    email: 'lorenzo.zuaro@gmail.com',
    createdAt: todayAt(9, 43, 56),
    orderStatus: 'submitted',
    paymentStatus: 'pending',
    reconciled: false,
    total: 5,
    allergies: '',
    items: [
      { name: 'Pizza Classica con Mozzarella, Pomodoro, Prosciutto Crudo', details: '', price: 3.5 },
      { name: 'Polpetta di melanzane', details: '', price: 1.5 }
    ]
  }
];

export const userOrdersFixture = [
  {
    id: 'order-user-mario',
    user: 'Mario Rossi',
    email: 'mario.rossi@dos.design',
    createdAt: todayAt(9, 15, 0),
    orderStatus: 'submitted',
    paymentStatus: 'pending',
    reconciled: false,
    total: 3.5,
    allergies: '',
    items: [
      { name: 'Porchetta', details: '', price: 3.5 }
    ]
  }
];

export async function seedCoreOrders(page: Page) {
  await page.addInitScript((orders) => {
    window.localStorage.setItem('dose_e2e', '1');
    window.localStorage.setItem('dose_e2e_orders_today', JSON.stringify(orders));
  }, coreOrdersFixture);
}

export async function seedUserOrders(page: Page) {
  await page.addInitScript((orders) => {
    window.localStorage.setItem('dose_e2e', '1');
    window.localStorage.setItem('dose_e2e_my_orders', JSON.stringify(orders));
  }, userOrdersFixture);
}

export async function clearCoreOrders(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.removeItem('dose_e2e_orders_today');
    window.localStorage.removeItem('dose_e2e_my_orders');
  });
}
