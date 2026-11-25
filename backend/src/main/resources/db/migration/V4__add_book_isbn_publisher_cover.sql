ALTER TABLE books
    ADD COLUMN isbn VARCHAR(20),
    ADD COLUMN publisher VARCHAR(150),
    ADD COLUMN cover_url VARCHAR(500);

CREATE INDEX idx_books_isbn ON books (isbn);
