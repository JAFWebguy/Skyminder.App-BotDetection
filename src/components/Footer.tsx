import React from 'react';
import { Shield, Info, FileText, MessageCircle, HelpCircle } from 'lucide-react';

export function Footer() {
  const navigation = [
    { name: 'About', href: '#', icon: Info },
    { name: 'Privacy Policy', href: '#', icon: Shield },
    { name: 'Terms of Service', href: '#', icon: FileText },
    { name: 'Contact', href: '#', icon: MessageCircle },
    { name: 'Help Center', href: '#', icon: HelpCircle },
  ];

  return (
    <footer className="bg-white border-t mt-8">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <nav className="flex flex-wrap justify-center gap-6">
          {navigation.map(({ name, href, icon: Icon }) => (
            <a
              key={name}
              href={href}
              className="flex items-center text-sm text-gray-600 hover:text-indigo-600 transition-colors"
            >
              <Icon className="w-4 h-4 mr-2" />
              {name}
            </a>
          ))}
        </nav>
        <div className="text-center mt-6 text-sm text-gray-500">
          <p>© {new Date().getFullYear()} Bluesky Follower Manager. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}