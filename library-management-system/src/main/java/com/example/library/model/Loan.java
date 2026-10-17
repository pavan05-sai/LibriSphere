package com.example.library.model;

import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name = "loans")
public class Loan {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    private Book book;

    @Column(nullable = false)
    private String borrower;

    @Column(nullable = false)
    private LocalDate issueDate;

    private LocalDate dueDate;

    private LocalDate returnDate;

    @Column(nullable = false)
    private boolean returned = false;

    public Loan() {}

    public Loan(Book book, String borrower) {
        this.book = book;
        this.borrower = borrower;
        this.issueDate = LocalDate.now();
        this.dueDate = LocalDate.now().plusDays(14);
        this.returned = false;
    }

    public Long getId() { return id; }
    public Book getBook() { return book; }
    public String getBorrower() { return borrower; }
    public LocalDate getIssueDate() { return issueDate; }
    public LocalDate getDueDate() { return dueDate; }
    public LocalDate getReturnDate() { return returnDate; }
    public boolean isReturned() { return returned; }

    public void setId(Long id) { this.id = id; }
    public void setBook(Book book) { this.book = book; }
    public void setBorrower(String borrower) { this.borrower = borrower; }
    public void setIssueDate(LocalDate issueDate) { this.issueDate = issueDate; }
    public void setDueDate(LocalDate dueDate) { this.dueDate = dueDate; }
    public void setReturnDate(LocalDate returnDate) { this.returnDate = returnDate; }
    public void setReturned(boolean returned) { this.returned = returned; }
}
