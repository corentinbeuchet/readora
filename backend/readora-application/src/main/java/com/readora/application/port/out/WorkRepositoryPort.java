package com.readora.application.port.out;

import com.readora.domain.work.Work;
import com.readora.domain.work.WorkId;
import java.util.List;
import java.util.Optional;

public interface WorkRepositoryPort {
    Optional<Work> findById(WorkId id);
    Work save(Work work);

    List<Work> findAll(int page, int size);

    long count();
}
