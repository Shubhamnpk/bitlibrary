import { Book } from './types';

export const INITIAL_BOOKS: Book[] = [
  {
    id: 'init-1',
    title: 'The Structure of Scientific Revolutions',
    author: 'Thomas S. Kuhn',
    category: 'Philosophy of Science',
    description: 'A landmark publication in history of science & philosophy showing how science progresses via paradigm shifts.',
    year: 1962,
    pages: 264,
    popularity: 98,
    coverGradient: 'bg-gradient-to-br from-orange-600 to-black'
  },
  {
    id: 'init-2',
    title: 'Gödel, Escher, Bach: An Eternal Golden Braid',
    author: 'Douglas Hofstadter',
    category: 'Cognitive Science',
    description: 'A metaphorical fugue on minds and machines in the spirit of Lewis Carroll.',
    year: 1979,
    pages: 777,
    popularity: 95,
    coverGradient: 'bg-gradient-to-br from-indigo-600 to-black'
  },
  {
    id: 'init-3',
    title: 'Silent Spring',
    author: 'Rachel Carson',
    category: 'Environmental Science',
    description: 'Documenting the adverse environmental effects caused by the indiscriminate use of pesticides.',
    year: 1962,
    pages: 368,
    popularity: 92,
    coverGradient: 'bg-gradient-to-br from-emerald-600 to-black'
  },
  {
    id: 'init-4',
    title: 'A Brief History of Time',
    author: 'Stephen Hawking',
    category: 'Cosmology',
    description: 'Explores profound questions about the universe, from the Big Bang to black holes.',
    year: 1988,
    pages: 256,
    popularity: 99,
    coverGradient: 'bg-gradient-to-br from-blue-600 to-black'
  }
];

export const CATEGORIES = [
  "Computer Science", "Physics", "History", "Philosophy", "Art", "Mathematics", "Biology", "Literature"
];
