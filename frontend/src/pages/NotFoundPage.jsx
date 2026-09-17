import React from 'react';
import { Link } from 'react-router-dom';

function NotFoundPage() {
  return <main className="landing-page"><section className="hero-card"><h1>Page not found</h1><p className="intro">This route has not been added yet.</p><Link className="home-link" to="/">Return home</Link></section></main>;
}

export default NotFoundPage;
