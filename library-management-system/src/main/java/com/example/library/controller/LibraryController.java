package com.example.library.controller;

import com.example.library.model.Book;
import com.example.library.model.Loan;
import com.example.library.repository.BookRepository;
import com.example.library.repository.LoanRepository;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@RestController
@RequestMapping("/api")
public class LibraryController {
    private final BookRepository books;
    private final LoanRepository loans;

    public LibraryController(BookRepository books, LoanRepository loans) {
        this.books = books;
        this.loans = loans;
    }

    @GetMapping("/books")
    public List<Book> getBooks(@RequestParam(required = false) String search,
                               @RequestParam(required = false) String category) {
        List<Book> all = books.findAll();
        return all.stream()
            .filter(b -> {
                if (category == null || category.isBlank() || "all".equalsIgnoreCase(category.trim())) {
                    return true;
                }
                return b.getCategory() != null && b.getCategory().equalsIgnoreCase(category.trim());
            })
            .filter(b -> {
                if (search == null || search.isBlank()) return true;
                String term = search.trim().toLowerCase();
                return (b.getTitle() != null && b.getTitle().toLowerCase().contains(term)) ||
                       (b.getAuthor() != null && b.getAuthor().toLowerCase().contains(term)) ||
                       (b.getCategory() != null && b.getCategory().toLowerCase().contains(term));
            })
            .toList();
    }

    @GetMapping("/books/{id}")
    public Book getBook(@PathVariable Long id) {
        return books.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Book not found with ID: " + id));
    }

    @GetMapping("/categories")
    public List<String> getCategories() {
        return books.findAll().stream()
                .map(Book::getCategory)
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .distinct()
                .sorted()
                .toList();
    }

    @PostMapping("/books")
    public Book addBook(@RequestBody BookRequest request) {
        validateBookRequest(request);
        return books.save(new Book(request.title().trim(), request.author().trim(),
                request.category() == null ? "General" : request.category().trim(), request.quantity()));
    }

    @PutMapping("/books/{id}")
    @Transactional
    public Book updateBook(@PathVariable Long id, @RequestBody BookRequest request) {
        validateBookRequest(request);
        Book book = books.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Book not found with ID: " + id));

        int loanedCount = book.getQuantity() - book.getAvailable();
        if (request.quantity() < loanedCount) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Total quantity cannot be less than currently issued copies (" + loanedCount + ").");
        }

        int quantityDifference = request.quantity() - book.getQuantity();
        book.setTitle(request.title().trim());
        book.setAuthor(request.author().trim());
        book.setCategory(request.category() == null ? "General" : request.category().trim());
        book.setQuantity(request.quantity());
        book.setAvailable(book.getAvailable() + quantityDifference);

        return books.save(book);
    }

    @DeleteMapping("/books/{id}")
    @Transactional
    public Map<String, String> deleteBook(@PathVariable Long id) {
        Book book = books.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Book not found."));
        if (loans.findAll().stream().anyMatch(l -> l.getBook().getId().equals(id) && !l.isReturned())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Cannot delete book while copies are currently issued. Return active loans first.");
        }
        loans.findAll().stream().filter(l -> l.getBook().getId().equals(id)).forEach(loans::delete);
        books.delete(book);
        return Map.of("message", "Book deleted successfully.");
    }

    @GetMapping("/loans")
    public List<Loan> getLoans() {
        return loans.findAllByOrderByIssueDateDescIdDesc();
    }

    @PostMapping("/loans")
    @Transactional
    public Loan issueBook(@RequestBody IssueRequest request) {
        if (request.bookId() == null || request.borrower() == null || request.borrower().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Select a book and enter the borrower's name.");
        }
        Book book = books.findById(request.bookId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Book not found."));
        if (book.getAvailable() < 1) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "No copies of '" + book.getTitle() + "' are currently available.");
        }
        book.setAvailable(book.getAvailable() - 1);
        books.save(book);
        return loans.save(new Loan(book, request.borrower().trim()));
    }

    @PutMapping("/loans/{id}/return")
    @Transactional
    public Loan returnBook(@PathVariable Long id) {
        Loan loan = loans.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Loan record not found."));
        if (loan.isReturned()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This book has already been marked as returned.");
        }
        loan.setReturned(true);
        loan.setReturnDate(LocalDate.now());
        Book book = loan.getBook();
        book.setAvailable(book.getAvailable() + 1);
        books.save(book);
        return loans.save(loan);
    }

    @GetMapping("/stats")
    public Map<String, Object> stats() {
        List<Book> allBooks = books.findAll();
        List<Loan> allLoans = loans.findAll();
        long totalCopies = allBooks.stream().mapToLong(Book::getQuantity).sum();
        long availableCopies = allBooks.stream().mapToLong(Book::getAvailable).sum();
        long activeLoans = allLoans.stream().filter(l -> !l.isReturned()).count();
        long totalLoans = allLoans.size();

        return Map.of(
            "titles", (long) allBooks.size(),
            "totalCopies", totalCopies,
            "availableCopies", availableCopies,
            "activeLoans", activeLoans,
            "totalLoans", totalLoans
        );
    }

    private void validateBookRequest(BookRequest request) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request body is required.");
        }
        if (request.title() == null || request.title().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Book title is required.");
        }
        if (request.author() == null || request.author().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Author name is required.");
        }
        if (request.quantity() < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Quantity must be at least 1.");
        }
    }

    public record BookRequest(String title, String author, String category, int quantity) {}
    public record IssueRequest(Long bookId, String borrower) {}
}
