import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Button, Form, Badge, Spinner, Stack } from 'react-bootstrap';
import { useAppStore, ThemeCatalogEntry, ThemeMode } from '../store';

const CATALOG_URL =
  'https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-css-themes.json';

const slugify = (value?: string) =>
  (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '') || 'custom';

interface ThemeBrowserModalProps {
  show: boolean;
  onHide: () => void;
}

export function ThemeBrowserModal({ show, onHide }: ThemeBrowserModalProps) {
  const [catalog, setCatalog] = useState<ThemeCatalogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [modeFilter, setModeFilter] = useState<'all' | ThemeMode>('all');

  const { themeMode, selectedTheme, applyCatalogTheme, setThemeMode, clearSelectedTheme } = useAppStore();

  useEffect(() => {
    if (!show || loading || (catalog.length > 0 && !error)) return;
    setLoading(true);
    setError(null);
    fetch(CATALOG_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Unable to load catalog (${response.status})`);
        }
        return response.json();
      })
      .then((data) => setCatalog(data))
      .catch((err) => {
        console.error(err);
        setError(err.message || 'Failed to load the catalog.');
      })
      .finally(() => setLoading(false));
  }, [show, catalog.length, error, loading]);

  const filteredThemes = useMemo(() => {
    const term = search.trim().toLowerCase();
    return catalog.map((entry) => ({
      ...entry,
      modes: entry.modes?.length ? entry.modes : (['dark'] as ThemeMode[]),
    })).filter((entry) => {
      const matchesMode = modeFilter === 'all' || entry.modes.includes(modeFilter);
      const matchesSearch =
        !term ||
        entry.name.toLowerCase().includes(term) ||
        (entry.author?.toLowerCase().includes(term) ?? false);
      return matchesMode && matchesSearch;
    });
  }, [catalog, modeFilter, search]);

  const handleRetry = () => {
    setCatalog([]);
    setError(null);
  };

  const isActive = (slug: string) => selectedTheme?.slug === slug;

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Obsidian Theme Browser</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="d-flex flex-wrap gap-2 mb-3 align-items-center">
          <Form.Control
            placeholder="Search theme or author"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-grow-1"
          />
          <Form.Select
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value as 'all' | ThemeMode)}
            style={{ minWidth: '140px' }}
          >
            <option value="all">All modes</option>
            <option value="dark">Dark only</option>
            <option value="light">Light only</option>
          </Form.Select>
          <Stack direction="horizontal" gap={2} className="flex-shrink-0">
            <Button
              variant={themeMode === 'light' ? 'primary' : 'outline-primary'}
              size="sm"
              onClick={() => setThemeMode('light')}
            >
              Light UI
            </Button>
            <Button
              variant={themeMode === 'dark' ? 'primary' : 'outline-primary'}
              size="sm"
              onClick={() => setThemeMode('dark')}
            >
              Dark UI
            </Button>
            <Button variant="outline-secondary" size="sm" onClick={clearSelectedTheme} disabled={!selectedTheme}>
              Reset Theme
            </Button>
          </Stack>
        </div>

        <p className="text-muted small mb-3">
          Catalog powered by the Obsidian community themes list ({catalog.length} entries). Select a theme to lock the
          palette and mode for this app, or open the repository to install it inside Obsidian.
        </p>

        {error && (
          <div className="alert alert-warning d-flex justify-content-between align-items-center py-2">
            <div className="small mb-0">{error}</div>
            <Button variant="outline-dark" size="sm" onClick={handleRetry}>
              Retry
            </Button>
          </div>
        )}

        <div className="theme-browser-grid">
          {loading && (
            <div className="text-center w-100 py-4">
              <Spinner animation="border" role="status" size="sm" className="me-2" /> Loading catalog…
            </div>
          )}
          {!loading && filteredThemes.length === 0 && (
            <div className="text-muted text-center py-4">No themes match this filter.</div>
          )}
          {filteredThemes.map((entry) => {
            const entrySlug = slugify(entry.name || entry.repo);
            const modes = entry.modes?.length ? entry.modes : (['dark'] as ThemeMode[]);
            const previewUrl = entry.screenshot
              ? `https://raw.githubusercontent.com/${entry.repo}/master/${encodeURI(entry.screenshot)}`
              : null;
            return (
              <div
                key={`${entry.repo}-${entry.name}`}
                className={`theme-card ${isActive(entrySlug) ? 'theme-card-active' : ''}`}
              >
                <div className="theme-card-body">
                  <div className="d-flex align-items-start justify-content-between gap-2 mb-1">
                    <div>
                      <h6 className="mb-1">{entry.name}</h6>
                      <div className="text-muted small">{entry.author || 'Unknown author'}</div>
                    </div>
                    <div className="text-end">
                      {entry.legacy && <Badge bg="secondary" className="me-1">legacy</Badge>}
                      {entry.publish && <Badge bg="info">published</Badge>}
                    </div>
                  </div>
                  <div className="d-flex flex-wrap gap-1 mb-2">
                    {modes.map((mode) => (
                      <Badge
                        key={`${entry.name}-${mode}`}
                        bg={mode === 'dark' ? 'dark' : 'light'}
                        text={mode === 'light' ? 'dark' : 'light'}
                      >
                        {mode}
                      </Badge>
                    ))}
                  </div>
                  {previewUrl && (
                    <div className="theme-card-screenshot mb-2">
                      <img src={previewUrl} alt={`${entry.name} preview`} loading="lazy" />
                    </div>
                  )}
                  <div className="d-flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant={isActive(entrySlug) ? 'success' : 'outline-primary'}
                      onClick={() => applyCatalogTheme({ ...entry, modes })}
                    >
                      {isActive(entrySlug) ? 'Applied' : 'Use Theme'}
                    </Button>
                    {previewUrl && (
                      <Button size="sm" variant="outline-secondary" href={previewUrl} target="_blank" rel="noreferrer">
                        Preview Screenshot
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="link"
                      href={`https://github.com/${entry.repo}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-0"
                    >
                      View Repo
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Modal.Body>
    </Modal>
  );
}
