import React, { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAppStore } from '@/store/main';

/**
 * UV_Landing
 * Landing Page (Marketing / Unauthenticated)
 * - Public marketing gateway with CTAs to Sign Up / Sign In
 * - If user is already authenticated, redirect to /dashboard
 * - All rendering occurs inside a single, large fragment (<></>) as per requirements
 */
const UV_Landing: React.FC = () => {
  // CRITICAL: Individual selectors for auth state (no object-destructuring)
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);

  // Simple testimonial carousel state (local only)
  type Testimonial = {
    author: string;
    role: string;
    quote: string;
    avatar_url?: string;
  };

  const testimonials: Testimonial[] = useMemo(
    () => [
      {
        author: 'Jordan Kim',
        role: 'Product Designer',
        quote:
          'PortfolioPro made my launch day effortless. I exported a polished site in minutes and got great feedback from clients.',
        avatar_url:
          'https://images.unsplash.com/photo-1506794778202-c3d4c5f0f0f0?q=80&w=128&h=128&fit=crop',
      },
      {
        author: 'Alex Doe',
        role: 'Front-end Developer',
        quote:
          'The live preview and theme tooling saved me tons of time. Clean templates and strong accessibility out of the box.',
        avatar_url:
          'https://images.unsplash.com/photo-1502685104226-ee32379fefbe?q=80&w=128&h=128&fit=crop',
      },
      {
        author: 'Priya N',
        role: 'Freelance Illustrator',
        quote:
          'Exported static site is flawless for hosting. Subdomain provisioning felt seamless with clear progress indicators.',
        avatar_url:
          'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=128&h=128&fit=crop',
      },
    ],
    []
  );

  const [testimonialIndex, setTestimonialIndex] = useState<number>(0);
  const nextTestimonial = () =>
    setTestimonialIndex((i) => (i + 1) % testimonials.length);
  const prevTestimonial = () =>
    setTestimonialIndex((i) =>
      i === 0 ? testimonials.length - 1 : (i - 1) % testimonials.length
    );

  // Feature highlights data
  const features = useMemo(
    () => [
      {
        title: 'Hero Editor',
        desc: 'Customize hero title, tagline, and imagery for a striking first impression.',
        icon: '🦊',
      },
      {
        title: 'Projects Manager',
        desc: 'Add up to 6+ projects with images, descriptions, and links.',
        icon: '🎯',
      },
      {
        title: 'Theme & Branding',
        desc: 'Two templates + color and typography controls for instant branding.',
        icon: '🎨',
      },
      {
        title: 'Export & Hosting',
        desc: 'One-click static export and subdomain hosting to publish fast.',
        icon: '🚀',
      },
    ],
    []
  );

  // If authenticated, redirect to dashboard (UX guidance in the UX map)
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <>
      {/* Marketing banner and hero (single cohesive render block) */}
      <header aria-label="Marketing header" className="bg-gradient-to-r from-blue-50 to-indigo-50">
        <section className="min-h-[12rem] flex items-center justify-center px-4 py-8 sm:py-12">
          <div className="max-w-7xl w-full flex flex-col md:flex-row items-center gap-6 md:gap-12">
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight">
                Publish your portfolio in minutes
              </h1>
              <p className="mt-3 text-lg text-gray-600 max-w-xl mx-auto md:mx-0">
                PortfolioPro MVP helps creatives and developers launch a polished, responsive portfolio with live preview, two templates, and hosting-ready exports.
              </p>
              <div className="mt-6 flex justify-center md:justify-start gap-4">
                <Link
                  to="/signup"
                  className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
                >
                  Get started
                </Link>
                <Link
                  to="/signin"
                  className="inline-flex items-center justify-center px-6 py-3 rounded-lg border border-gray-300 text-gray-900 text-sm font-medium hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-blue-100"
                >
                  Sign in
                </Link>
              </div>
            </div>
            <div className="flex-1 w-full max-w-md mx-auto">
              <img
                src="https://images.unsplash.com/photo-1499951360447-b1905bc2446a?q=80&w=800&h=600&fit=crop"
                alt="Marketing illustration of creators building a portfolio"
                className="w-full h-auto rounded-xl shadow-lg"
              />
            </div>
          </div>
        </section>
      </header>

      {/* Feature highlights section */}
      <main aria-label="Feature highlights" className="bg-white py-12">
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl md:text-3xl font-semibold text-gray-900 mb-6 text-center">
            What you get with PortfolioPro MVP
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f, idx) => (
              <div key={idx} className="p-6 border border-gray-200 rounded-xl hover:shadow-md transition-shadow duration-200">
                <div className="flex items-center justify-start mb-3 h-10 w-10 rounded-full bg-blue-100 text-blue-700 font-bold text-lg">
                  <span aria-label={`${f.title} icon`} className="mx-auto">{f.icon}</span>
                </div>
                <h3 className="text-md font-semibold text-gray-900">{f.title}</h3>
                <p className="text-sm text-gray-600 mt-1">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Testimonials cluster */}
      <section aria-label="Testimonials" className="bg-gray-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl md:text-3xl font-semibold text-gray-900 text-center mb-6">
            What creators say
          </h2>

          {/* Carousel controls (accessible) */}
          <div className="flex items-center justify-center mb-4" aria-label="Testimonials controls">
            <button
              onClick={prevTestimonial}
              aria-label="Previous testimonial"
              className="mx-2 p-2 rounded-md bg-white border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              <span aria-hidden="true">‹</span>
            </button>
            <button
              onClick={nextTestimonial}
              aria-label="Next testimonial"
              className="mx-2 p-2 rounded-md bg-white border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              <span aria-hidden="true">›</span>
            </button>
          </div>

          <div className="relative max-w-3xl mx-auto" role="group" aria-label="Current testimonial">
            {testimonials.map((t, idx) => (
              <article
                key={idx}
                className={idx === testimonialIndex ? 'block' : 'hidden'}
                aria-label={`Testimonial by ${t.author}`}
              >
                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                  <p className="text-gray-700 text-base italic">"{t.quote}"</p>
                  <div className="mt-4 flex items-center gap-3">
                    <img
                      src={t.avatar_url}
                      alt={`Avatar of ${t.author}`}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                    <div>
                      <div className="text-sm font-semibold text-gray-800">{t.author}</div>
                      <div className="text-xs text-gray-600">{t.role}</div>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-6 text-center text-sm text-gray-500" aria-live="polite">
            {testimonials.length > 0 ? `Testimonial ${testimonialIndex + 1} of ${testimonials.length}` : ''}
          </div>
        </div>
      </section>

      {/* Footer links */}
      <footer aria-label="Footer links" className="bg-white border-t border-gray-200">
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-sm text-gray-600">
            © PortfolioPro MVP. All rights reserved.
          </div>
          <nav aria-label="Footer legal">
            <ul className="flex space-x-4">
              <li>
                <Link to="/help" className="text-sm text-gray-700 hover:text-gray-900">
                  Help
                </Link>
              </li>
              <li>
                <Link to="/terms" className="text-sm text-gray-700 hover:text-gray-900">
                  Terms
                </Link>
              </li>
            </ul>
          </nav>
        </section>
      </footer>
    </>
  );
};

export default UV_Landing;