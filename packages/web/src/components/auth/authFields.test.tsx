import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { useState } from 'react';
import { PasswordField } from './authFields';
afterEach(cleanup);
it('updates the visible requirement as the user chooses a password', () => {
  function Form() {
    const [value, setValue] = useState('');
    return <PasswordField id="password" label="Senha" value={value} onChange={setValue} creating />;
  }
  render(<Form />);
  expect(screen.getByRole('list', { name: 'Critérios da senha' })).toHaveTextContent('pendente');
  fireEvent.change(screen.getByLabelText('Senha', { exact: true }), { target: { value: 'frase longa' } });
  expect(screen.getByRole('list', { name: 'Critérios da senha' })).toHaveTextContent('atendido');
  fireEvent.change(screen.getByLabelText('Senha', { exact: true }), { target: { value: 'curta' } });
  expect(screen.getByRole('list', { name: 'Critérios da senha' })).toHaveTextContent('pendente');
  expect(screen.queryByRole('button', { name: /Ajuda/ })).not.toBeInTheDocument();
});
