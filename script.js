// In script.js

document.addEventListener('DOMContentLoaded', () => {
    const calendarGrid = document.querySelector('.calendar-grid');
    const timeColumn = document.querySelector('.time-column');
    const instructorFilter = document.getElementById('instructor-filter');
    const typeFilter = document.getElementById('type-filter');
    const locationFilter = document.getElementById('location-filter');
    const courseCheckboxesContainer = document.getElementById('course-checkboxes');
    const resetBtn = document.getElementById('reset-filters');
    const unscheduledCoursesList = document.getElementById('unscheduled-courses-list');

    const START_HOUR = 7;
    const END_HOUR = 20;
    const dayMap = { 'M': 'Mo', 'T': 'Tu', 'W': 'We', 'R': 'Th', 'F': 'Fr' };
    let allCourses = [];
    const courseColorMap = new Map();

    generateTimeSlots();
    fetchDataAndInitialize();

    instructorFilter.addEventListener('change', filterAndRedrawCalendar);
    typeFilter.addEventListener('change', filterAndRedrawCalendar);
    locationFilter.addEventListener('change', filterAndRedrawCalendar);
    courseCheckboxesContainer.addEventListener('change', filterAndRedrawCalendar);

    resetBtn.addEventListener('click', () => {
        instructorFilter.value = 'all';
        typeFilter.value = 'all';
        locationFilter.value = 'all';
        document.querySelectorAll('#course-checkboxes input[type="checkbox"]').forEach(cb => cb.checked = false);
        filterAndRedrawCalendar();
    });

    function stringToHslColor(str, s = 65, l = 75) {
        const levelHues = {
            '1000': 200, '2000': 120, '3000': 240,
            '4000': 30,  '5000': 0,   '6000': 280,
        };
        let baseHue = 300;
        const parts = str.split(' ');
        if (parts.length > 1) {
            const courseNum = parseInt(parts[parts.length - 1], 10);
            if (!isNaN(courseNum)) {
                const level = Math.floor(courseNum / 1000) * 1000;
                if (level in levelHues) baseHue = levelHues[level];
            }
        }
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        const lightnessVariation = hash % 15;
        return `hsl(${baseHue}, ${s}%, ${l - lightnessVariation}%)`;
    }

    function generateTimeSlots() {
        for (let hour = START_HOUR; hour <= END_HOUR; hour++) {
            const timeSlot = document.createElement('div');
            timeSlot.classList.add('time-slot');
            timeSlot.innerText = `${hour}:00`;
            timeColumn.appendChild(timeSlot);
        }
    }

    function fetchDataAndInitialize() {
        fetch('S26schedule.json')
            .then(response => response.json())
            .then(data => {
                allCourses = data.map(course => {
                    const timeString = course.time_of_day;
                    if (!timeString || !timeString.match(/(\d{1,2}:\d{2})(AM|PM)/)) {
                        return { ...course, startMinutes: null, endMinutes: null };
                    }
                    const timeParts = timeString.match(/(\d{1,2}:\d{2})(AM|PM)/);
                    const [time, ampm] = [timeParts[1], timeParts[2]];
                    let [hour, minute] = time.split(':').map(Number);
                    if (ampm === 'PM' && hour !== 12) hour += 12;
                    if (ampm === 'AM' && hour === 12) hour = 0;
                    const startMinutes = (hour * 60) + minute;
                    const endMinutes = startMinutes + course.duration;
                    return { ...course, startMinutes, endMinutes };
                });
                populateFilters(allCourses);
                filterAndRedrawCalendar();
            })
            .catch(error => console.error('[FATAL] Error loading schedule data:', error));
    }
    
    function populateFilters(courses) {
        const uniqueCourses = [...new Set(courses.map(course => course.course_number))].sort();
        uniqueCourses.forEach(courseName => {
            courseColorMap.set(courseName, stringToHslColor(courseName));
        });
        const allInstructorNames = courses.flatMap(course => course.instructors.split(';').map(name => name.trim()));
        const uniqueInstructors = [...new Set(allInstructorNames)].sort();
        uniqueInstructors.forEach(name => {
            if (name && name.toLowerCase() !== 'nan') {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                instructorFilter.appendChild(option);
            }
        });
        const uniqueTypes = [...new Set(courses.map(course => course.type))].sort();
        uniqueTypes.forEach(typeName => {
            if (typeName && typeName.toLowerCase() !== 'nan') {
                const option = document.createElement('option');
                option.value = typeName;
                option.textContent = typeName;
                typeFilter.appendChild(option);
            }
        });
        const allLocationNames = courses.flatMap(course => (course.location || '').split(';').map(name => name.trim()));
        const uniqueLocations = [...new Set(allLocationNames)].sort();
        uniqueLocations.forEach(locationName => {
            if (locationName && locationName.toLowerCase() !== 'nan') {
                const option = document.createElement('option');
                option.value = locationName;
                option.textContent = locationName;
                locationFilter.appendChild(option);
            }
        });
        uniqueCourses.forEach(courseName => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'checkbox-item';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = courseName;
            checkbox.value = courseName;
            const label = document.createElement('label');
            label.htmlFor = courseName;
            label.textContent = courseName;
            itemDiv.appendChild(checkbox);
            itemDiv.appendChild(label);
            courseCheckboxesContainer.appendChild(itemDiv);
        });
    }

    function filterAndRedrawCalendar() {
        document.querySelectorAll('.class-event').forEach(event => event.remove());
        const selectedInstructor = instructorFilter.value;
        const selectedType = typeFilter.value;
        const selectedLocation = locationFilter.value;
        const selectedCourses = Array.from(document.querySelectorAll('#course-checkboxes input:checked')).map(cb => cb.value);
        const filteredCourses = allCourses.filter(course => {
            const instructorMatch = (selectedInstructor === 'all' || (course.instructors && course.instructors.includes(selectedInstructor)));
            const typeMatch = (selectedType === 'all' || course.type === selectedType);
            const locationMatch = (selectedLocation === 'all' || (course.location && course.location.includes(selectedLocation)));
            const courseMatch = (selectedCourses.length === 0 || selectedCourses.includes(course.course_number));
            return instructorMatch && typeMatch && courseMatch && locationMatch;
        });
        const schedulableCourses = filteredCourses.filter(c => c.startMinutes !== null && c.days && c.days.trim() !== '');
        const unschedulableCourses = filteredCourses.filter(c => c.startMinutes === null || !c.days || c.days.trim() === '');
        calculateAndDisplayMetrics(schedulableCourses);
        displayUnscheduledCourses(unschedulableCourses);
        Object.values(dayMap).forEach(dayCode => {
            const dayEvents = schedulableCourses
                .filter(course => course.days.includes(Object.keys(dayMap).find(key => dayMap[key] === dayCode)))
                .sort((a, b) => a.startMinutes - b.startMinutes);
            if (dayEvents.length === 0) return;
            let columns = [];
            dayEvents.forEach(event => {
                let placed = false;
                for (const column of columns) {
                    const lastEventInColumn = column[column.length - 1];
                    if (event.startMinutes >= lastEventInColumn.endMinutes) {
                        column.push(event);
                        placed = true;
                        break;
                    }
                }
                if (!placed) columns.push([event]);
            });
            const totalColumns = columns.length;
            columns.forEach((column, columnIndex) => {
                column.forEach(event => {
                    const width = 100 / totalColumns;
                    const left = columnIndex * width;
                    placeCourseOnCalendar(event, dayCode, width, left);
                });
            });
        });
    }

    function displayUnscheduledCourses(courses) {
        unscheduledCoursesList.innerHTML = '';
        if (courses.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'No selected courses without a fixed schedule.';
            li.style.fontStyle = 'italic';
            unscheduledCoursesList.appendChild(li);
            return;
        }
        courses.forEach(course => {
            const li = document.createElement('li');
            li.innerHTML = `
                <strong>${course.course_number} (${course.type || 'N/A'})</strong><br>
                Instructor(s): ${course.instructors || 'N/A'}<br>
                Location: ${course.location || 'N/A'}<br>
                ${course.notes ? `Notes: ${course.notes}` : ''}
            `;
            unscheduledCoursesList.appendChild(li);
        });
    }

    function calculateAndDisplayMetrics(courses) {
        const primeTimeStart = 9 * 60;
        const primeTimeEnd = 14 * 60;
        let mebRoomUsageMinutes = { "MEB 1292": 0, "MEB 2550": 0, "MEB 3520": 0 };
        let mwfPrimeTimeMinutes = 0;
        let trPrimeTimeMinutes = 0;
        let dailyMinutes = { Mo: 0, Tu: 0, We: 0, Th: 0, Fr: 0 };
        courses.forEach(course => {
            if (course.course_number.startsWith("ENGIN")) {
                const courseLocations = (course.location || '').split(';').map(l => l.trim());
                courseLocations.forEach(loc => {
                    if (loc in mebRoomUsageMinutes) {
                        mebRoomUsageMinutes[loc] += course.duration * course.days.length;
                    }
                });
            }
            if (!course.course_number.startsWith("CH EN")) return;
            const courseNumStr = course.course_number.replace("CH EN", "").trim();
            const courseNum = parseInt(courseNumStr, 10);
            if (isNaN(courseNum) || courseNum < 1000 || courseNum > 5999) return;
            if (!course.duration || !course.days || !course.startMinutes) return;
            const courseEndMinutes = course.startMinutes + course.duration;
            const overlapStart = Math.max(course.startMinutes, primeTimeStart);
            const overlapEnd = Math.min(courseEndMinutes, primeTimeEnd);
            const primeMinutesForThisCourse = Math.max(0, overlapEnd - overlapStart);
            for (const dayChar of course.days) {
                const dayCode = dayMap[dayChar];
                if (!dayCode) continue;
                dailyMinutes[dayCode] += course.duration;
                if (dayChar === 'M' || dayChar === 'W' || dayChar === 'F') {
                    mwfPrimeTimeMinutes += primeMinutesForThisCourse;
                } else if (dayChar === 'T' || dayChar === 'R') {
                    trPrimeTimeMinutes += primeMinutesForThisCourse;
                }
            }
        });
        const totalWeeklyMinutes = Object.values(dailyMinutes).reduce((sum, mins) => sum + mins, 0);
        const totalPrimeTimeMinutes = mwfPrimeTimeMinutes + trPrimeTimeMinutes;
        const totalMinutesOutsidePrime = totalWeeklyMinutes - totalPrimeTimeMinutes;
        document.getElementById('metric-meb-1292').textContent = (mebRoomUsageMinutes["MEB 1292"] / 60).toFixed(1);
        document.getElementById('metric-meb-2550').textContent = (mebRoomUsageMinutes["MEB 2550"] / 60).toFixed(1);
        document.getElementById('metric-meb-3520').textContent = (mebRoomUsageMinutes["MEB 3520"] / 60).toFixed(1);
        const mwfPrimePercentage = (totalWeeklyMinutes > 0) ? (mwfPrimeTimeMinutes / totalWeeklyMinutes) * 100 : 0;
        const trPrimePercentage = (totalWeeklyMinutes > 0) ? (trPrimeTimeMinutes / totalWeeklyMinutes) * 100 : 0;
        const outsidePrimePercentage = (totalWeeklyMinutes > 0) ? (totalMinutesOutsidePrime / totalWeeklyMinutes) * 100 : 0;
        document.getElementById('metric-mwf-prime').textContent = mwfPrimePercentage.toFixed(0);
        document.getElementById('metric-tr-prime').textContent = trPrimePercentage.toFixed(0);
        document.getElementById('metric-outside-prime-hrs').textContent = (totalMinutesOutsidePrime / 60).toFixed(1);
        document.getElementById('metric-outside-prime-pct').textContent = outsidePrimePercentage.toFixed(0);
        document.getElementById('metric-mo-hrs').textContent = (dailyMinutes.Mo / 60).toFixed(1);
        document.getElementById('metric-tu-hrs').textContent = (dailyMinutes.Tu / 60).toFixed(1);
        document.getElementById('metric-we-hrs').textContent = (dailyMinutes.We / 60).toFixed(1);
        document.getElementById('metric-th-hrs').textContent = (dailyMinutes.Th / 60).toFixed(1);
        document.getElementById('metric-fr-hrs').textContent = (dailyMinutes.Fr / 60).toFixed(1);
        document.getElementById('metric-mo-pct').textContent = (totalWeeklyMinutes > 0 ? (dailyMinutes.Mo / totalWeeklyMinutes) * 100 : 0).toFixed(0);
        document.getElementById('metric-tu-pct').textContent = (totalWeeklyMinutes > 0 ? (dailyMinutes.Tu / totalWeeklyMinutes) * 100 : 0).toFixed(0);
        document.getElementById('metric-we-pct').textContent = (totalWeeklyMinutes > 0 ? (dailyMinutes.We / totalWeeklyMinutes) * 100 : 0).toFixed(0);
        document.getElementById('metric-th-pct').textContent = (totalWeeklyMinutes > 0 ? (dailyMinutes.Th / totalWeeklyMinutes) * 100 : 0).toFixed(0);
        document.getElementById('metric-fr-pct').textContent = (totalWeeklyMinutes > 0 ? (dailyMinutes.Fr / totalWeeklyMinutes) * 100 : 0).toFixed(0);
        document.getElementById('metric-total-hrs').textContent = (totalWeeklyMinutes / 60).toFixed(1);
    }
    
    // --- MODIFIED --- This function now has event listeners to manage the tooltip position
    function placeCourseOnCalendar(course, day, width = 100, left = 0) {
        const column = document.querySelector(`.day-content[data-day="${day}"]`);
        if (!column) return;
        
        const minutesSinceCalendarStart = course.startMinutes - (START_HOUR * 60);
        const topPosition = minutesSinceCalendarStart;
        const height = course.duration;
        if (!height || topPosition < 0) return;
        
        const eventDiv = document.createElement('div');
        eventDiv.className = 'class-event';
        
        eventDiv.style.top = `${topPosition}px`;
        eventDiv.style.height = `${height}px`;
        eventDiv.style.width = `calc(${width}% - 4px)`;
        eventDiv.style.left = `${left}%`;
        
        const color = courseColorMap.get(course.course_number) || '#a3c4f3';
        eventDiv.style.backgroundColor = color;
        eventDiv.style.borderColor = `hsl(${parseInt(color.substring(4))}, 50%, 60%)`;

        eventDiv.innerHTML = `
            <div class="event-title">${course.course_number}</div>
            <div class="event-tooltip">
                <strong>Course:</strong> ${course.course_number}<br>
                <strong>Instructor:</strong> ${course.instructors}<br>
                <strong>Time:</strong> ${course.time_of_day}<br>
                <strong>Location:</strong> ${course.location}<br>
                <strong>Type:</strong> ${course.type}<br>
                <strong>Duration:</strong> ${course.duration} min<br>
                ${course.notes ? `<strong>Notes:</strong> ${course.notes}<br>` : ''}
                ${course.anticipated_enrollment ? `<strong>Anticipated Enrollment:</strong> ${course.anticipated_enrollment}` : ''}
            </div>`;
            
        column.appendChild(eventDiv);

        // --- NEW: Event listeners for smart tooltip positioning ---
        eventDiv.addEventListener('mouseover', () => {
            const tooltip = eventDiv.querySelector('.event-tooltip');
            tooltip.classList.add('tooltip-visible'); // Make it visible to measure its size

            const tooltipRect = tooltip.getBoundingClientRect();
            const viewportWidth = window.innerWidth;

            // If the tooltip goes off the right edge of the screen...
            if (tooltipRect.right > viewportWidth) {
                tooltip.classList.add('tooltip-left'); //...flip it to the left side.
            }
        });

        eventDiv.addEventListener('mouseout', () => {
            const tooltip = eventDiv.querySelector('.event-tooltip');
            tooltip.classList.remove('tooltip-visible');
            tooltip.classList.remove('tooltip-left'); // Always remove the left-position class on mouseout
        });
    }
});
