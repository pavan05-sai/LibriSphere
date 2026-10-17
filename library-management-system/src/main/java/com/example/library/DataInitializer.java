package com.example.library;

import com.example.library.model.Book;
import com.example.library.repository.BookRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

@Component
public class DataInitializer implements CommandLineRunner {

    private final BookRepository bookRepository;

    public DataInitializer(BookRepository bookRepository) {
        this.bookRepository = bookRepository;
    }

    @Override
    public void run(String... args) {
        if (bookRepository.count() == 0) {
            List<BookSeed> seeds = new ArrayList<>(List.of(
                    new BookSeed("The Left Hand of Darkness", "Ursula K. Le Guin", "Science Fiction"),
                    new BookSeed("Pride and Prejudice", "Jane Austen", "Classic Literature"),
                    new BookSeed("The Name of the Rose", "Umberto Eco", "Mystery"),
                    new BookSeed("Beloved", "Toni Morrison", "Literary Fiction"),
                    new BookSeed("The Dispossessed", "Ursula K. Le Guin", "Science Fiction"),
                    new BookSeed("Invisible Cities", "Italo Calvino", "Literary Fiction"),
                    new BookSeed("Kindred", "Octavia E. Butler", "Science Fiction"),
                    new BookSeed("The Shadow of the Wind", "Carlos Ruiz Zafon", "Mystery"),
                    new BookSeed("The Remains of the Day", "Kazuo Ishiguro", "Literary Fiction"),
                    new BookSeed("A Wizard of Earthsea", "Ursula K. Le Guin", "Fantasy")
            ));
            Collections.shuffle(seeds);
            seeds.forEach(seed -> bookRepository.save(new Book(seed.title(), seed.author(), seed.category(),
                    ThreadLocalRandom.current().nextInt(1, 6))));
        }
    }

    private record BookSeed(String title, String author, String category) {}
}
