import { describe, it } from 'vitest';
import {render, screen} from '@testing-library/react';
import {BannedUsers} from '@/components/src/client/routes/admin/components/Ban';

// describe('Simple Test', () => {
//   it('adds two numbers correctly', () => {
//     const sum = 1 + 1;
//     expect(sum).toBe(2);
//   });

//   it('checks if a string contains a substring', () => {
//     const text = 'Hello, Vitest!';
//     expect(text).toContain('Vitest');
//   });
// });