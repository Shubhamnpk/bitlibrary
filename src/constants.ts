import { Book } from './types';

export const INITIAL_BOOKS: Book[] = [];

export const CATEGORIES = [
  "Poetry", "Fiction", "Nepali Literature", "Mystery", "History",
  "Philosophy", "Biography", "Science", "Children",
  "Adventure", "Romance", "Drama", "Short Stories"
];

export const CURRICULUM_GRADES = Array.from({ length: 12 }, (_, index) => index + 1);

export const CURRICULUM_SUBJECTS = [
  "Nepali",
  "English",
  "Mathematics",
  "Science",
  "Social Studies",
  "Health",
  "Hamro Serofero",
];
