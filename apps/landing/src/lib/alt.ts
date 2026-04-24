import type { Employee } from '@/components/veqiro/data';

export const agentAlt = (emp: Employee): string =>
  `${emp.name}, Veqiro's AI ${emp.role}`;
