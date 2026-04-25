package com.example.timetablescheduler.repository;

import com.example.timetablescheduler.model.TimeSlot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TimeSlotRepository extends JpaRepository<TimeSlot, Long> {
    List<TimeSlot> findAllByOrderByDayOfWeekAscOrderIndexAsc();
}
