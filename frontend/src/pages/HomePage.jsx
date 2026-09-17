import React from 'react';
import { Link } from 'react-router-dom';

function HomePage() {
  const phases = ['Authentication & RBAC', 'Admin & user management', 'Encrypted paper workflow', 'Blockchain approvals'];
  return (
    <main className="landing-page">
      <section className="hero-card">
        <p className="eyebrow">SECURE EXAMINATION PLATFORM</p>
        <h1>Secure Question-Paper Management System</h1>
        <p className="intro">A protected workflow for creating, reviewing, approving, and releasing examination papers.</p>
        <div className="status"><span className="status-dot" /> Phase 1 foundation is running</div>
        <p><Link className="home-link" to="/login">Sign in</Link> <Link className="home-link" to="/register">Register</Link></p>
      </section>
      <section className="phase-grid">
        {phases.map((phase, index) => <article className="phase-card" key={phase}><span>0{index + 2}</span><h2>{phase}</h2><p>Planned secure module.</p></article>)}
      </section>
    </main>
  );
}

export default HomePage;
