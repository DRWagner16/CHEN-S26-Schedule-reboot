// In script.js

document.addEventListener('DOMContentLoaded', () => {
    const calendarGrid = document.querySelector('.calendar-grid');
    const timeColumn = document.querySelector('.time-column');
    const instructorFilter = document.getElementById('instructor-filter');
    const typeFilter = document.getElementById('type-filter');
    const locationFilter = document.getElementById('location-filter');
    const courseCheckboxesContainer = document.getElementById('course-checkboxes');
    const resetBtn = document.getElementById('reset-filters');

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

    function stringToHslColor(str, s = 60, l = 75) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        const h = hash % 360;
        return `hsl(${h}, ${s}%, ${l}%)`;
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
                    const timeParts = timeString.match(/(\d{1,2}:\d{2})(AM|PM)/);
                    if (!timeParts) return { ...course, startMinutes: null, endMinutes: null };
                    
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

        const uniqueLocations = [...new Set(courses.map(course => course.location))].sort();
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
            const instructorMatch = (selectedInstructor === 'all' || course.instructors.includes(selectedInstructor));
            const typeMatch = (selectedType === 'all' || course.type === selectedType);
            const locationMatch = (selectedLocation === 'all' || course.location === selectedLocation);
            const courseMatch = (selectedCourses.length === 0 || selectedCourses.includes(course.course_number));
            return instructorMatch && typeMatch && courseMatch && locationMatch;
        });

        calculateAndDisplayMetrics(filteredCourses);

        Object.values(dayMap).forEach(dayCode => {
            const dayEvents = filteredCourses
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
                if (!placed) {
                    columns.push([event]);
                }
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

    // --- MODIFIED --- This function is completely new to handle your specific metric requests
    function calculateAndDisplayMetrics(courses) {
        // --- Metric 1: MEB Room Usage ---
        const mebRooms = ["MEB 1292", "MEB 2550", "MEB 3520"];
        let mebUsageMinutes = 0;

        // --- Metric 2 & 3: CH EN Prime Time ---
        const primeTimeStart = 9 * 60; // 9:00 AM in minutes
        const primeTimeEnd = 14 * 60; // 2:00 PM in minutes
        let chenCoursesInPrimeTime = 0;
        let totalChenCourses = 0;
        let chenTimeInPrimeTimeMinutes = 0;
        let totalChenTimeMinutes = 0;

        // --- Metric 4: CH EN Daily/Weekly Summary ---
        let totalWeeklyChenMinutes = 0;
        const dailyChenMinutes = { Mo: 0, Tu: 0, We: 0, Th: 0, Fr: 0 };

        // --- Loop through all filtered courses to calculate metrics ---
        courses.forEach(course => {
            if (!course.duration || !course.days) return; // Skip courses with no duration or days

            const weeklyDuration = course.duration * course.days.length;

            // Calculate MEB usage
            if (mebRooms.includes(course.location)) {
                mebUsageMinutes += weeklyDuration;
            }

            // Check if it's a CH EN course for the other metrics
            if (course.course_number.startsWith("CH EN")) {
                totalChenCourses++;
                totalChenTimeMinutes += weeklyDuration;

                // Calculate CH EN Weekly Summary
                totalWeeklyChenMinutes += weeklyDuration;
                for (const dayChar of course.days) {
                    const dayCode = dayMap[dayChar];
                    if (dayCode in dailyChenMinutes) {
                        dailyChenMinutes[dayCode] += course.duration;
                    }
                }

                // Check for Prime Time
                if (course.startMinutes >= primeTimeStart && course.startMinutes < primeTimeEnd) {
                    chenCoursesInPrimeTime++;
                    chenTimeInPrimeTimeMinutes += weeklyDuration;
                }
            }
        });

        // --- Final Calculations & Display ---
        
        // Display MEB Usage
        document.getElementById('metric-meb-usage').textContent = (mebUsageMinutes / 60).toFixed(1);

        // Display CH EN Prime Time Metrics
        const primeCoursePercentage = (totalChenCourses > 0) ? (chenCoursesInPrimeTime / totalChenCourses) * 100 : 0;
        const primeTimePercentage = (totalChenTimeMinutes > 0) ? (chenTimeInPrimeTimeMinutes / totalChenTimeMinutes) * 100 : 0;
        document.getElementById('metric-chen-prime-courses').textContent = primeCoursePercentage.toFixed(0);
        document.getElementById('metric-chen-prime-time').textContent = primeTimePercentage.toFixed(0);

        // Display CH EN Daily/Weekly Summary
        document.getElementById('metric-mo').textContent = (dailyChenMinutes.Mo / 60).toFixed(1);
        document.getElementById('metric-tu').textContent = (dailyChenMinutes.Tu / 60).toFixed(1);
        document.getElementById('metric-we').textContent = (dailyChenMinutes.We / 60).toFixed(1);
        document.getElementById('metric-th').textContent = (dailyChenMinutes.Th / 60).toFixed(1);
        document.getElementById('metric-fr').textContent = (dailyChenMinutes.Fr / 60).toFixed(1);
        document.getElementById('metric-total').textContent = (totalWeeklyChenMinutes / 60).toFixed(1);
    }
    
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
                ${course.notes ? `<strong>Notes:</strong> ${course.notes}` : ''}
            </div>`;
            
        column.appendChild(eventDiv);
    }
});
