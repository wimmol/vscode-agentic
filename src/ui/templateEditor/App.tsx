import { TemplateEditorPage } from './TemplateEditorPage';
import { ErrorBoundary } from '../shared/atoms/ErrorBoundary';

export const App = () => (
  <ErrorBoundary>
    <TemplateEditorPage />
  </ErrorBoundary>
);
