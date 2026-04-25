package com.example.timetablescheduler.repository;

import com.example.timetablescheduler.model.TimetableEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TimetableRepository extends JpaRepository<TimetableEntry, Long> {
    List<TimetableEntry> findByClassName(String className);

    List<TimetableEntry> findByTeacherId(Long teacherId);

    List<TimetableEntry> findByClassNameAndTimeSlot_Id(String className, Long timeSlotId);

    boolean existsByTeacher_IdAndTimeSlot_Id(Long teacherId, Long timeSlotId);

    boolean existsByRoom_IdAndTimeSlot_Id(Long roomId, Long timeSlotId);
}
