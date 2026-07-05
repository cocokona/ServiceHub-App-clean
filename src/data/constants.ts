import { Job, Message, Technician } from '../types';

export const IMAGE_URLS = {
  heroBanner: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCX5cgpRTkBVQ1iUdB4S7Ft25lEA1LbckF9tGSyJ18tVr0RoqIf-qW3HlXkleGDuFJa79lm8NtbXjON9CQe2RxLqnn9_JB76AvBjJJiIDjytxbE4aGPS3OYhqrUu20tbc6-Viz0uLjy4OZXGcATVocSy6_Z9NRrGr3IbFCIGRZeBW6BdJwas6iZCnE4nMWMPTG6lvdP4lsBjSLSPiiGwoTTmIAkvG3Silo001RzSin7N_I6PSIvYTeI8Qk30wA39MmTNJXCbZbrgZs',
  femaleTechSarah: 'https://lh3.googleusercontent.com/aida-public/AB6AXuADPKHqGTjtyh5jrVyzIHPPYMjWxKmDP2_EEsvkpc8jiuzGaxT-i56yO6WStlReDSwi5ELG8TiqpYQhw8BKxRZfNFS9B8G4_b0glyyIpzCj3nN1f-KqAdrnyuOzbUaMN2Dv8-YhwmwWULMr-PfE0ltqNBHmWJ5CqJc0y42ZSOQRHW__22RAFa4vHZQBtE6mRaasTrweJ6kG_C19NC46U1Mcq7yFNnfnhmkETRYE63XtvBYt7QHmng6w2x7o6qwbTKLov3-jI408nR8',
  maleTechMichael: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAsI5wNWB5bRXbjsi7z3cb-gaQdCx78QtQPegykn5-sNxvraFa-pV5PN3l5QOEYzczFPTckLW3MezjwKVjBiUDL1BNsawyhsaVqBndD5O6E-PbU-4NxCLhG-WbJjQDlnUMm8NujdM1NGgEqIQ8Sh1aoDQEOjSg3YclgRsfJHuyvdgrjMs5znGhepWdZzVUphUJ3fxuu3lyfvqAIl9MmvX1IlUiiloO4MfTreYUYAKlW8P582wuSIJaNtTzV_VBhXSuCB9hmOrnFrp8',
  supportSarah: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBis3olKu54WT33Gzohn8AO3YJTBV7hB3qa7C6FfW-OrjnUljfFpPk3M4ndbBP3Ob2CFoLEbdMt4iC5dNNgbAqaEryj90Ln3zY9vS0boz52cgtoaQzV3UBwPLEc6laXHwxfm417Y0hQhjmnma1afKX47M5AoEpFyM9Fe7TGXxZSdsk-jpEuZK7FHVqXlfFbzdMqADKs_R0Tzk_em3VRhCZek0JeMGx8JaVO-6a3sZxzwe4LDpl_dOQkmcTVsKmKfUEY8LyCMyjOjRU',
  supportSarahAlt: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCZVYuqIYyqHG_5bnhqDXEFWVP6rjFl8QClr_bz82ykucKk3TNFavMwhQeKe0xgo_0D-dP9MyOBsPqSWYE4CiMqlm2kYb0Cg-P-AauAxYhKwZSeBGkNSqQU4Ve6juMjNNDqXRPluZPKsUDaV5KsG3PULdvxO0UCBH0ChshbJJpe4xdvekv54ZYHu8qVjSSbeFF79fZXhxniA66Zj0D6NK0u92lcYNDOhA9hpiaFShQXFeWLdUFSoJxPMedPlziTFEkbNexoTmEdqOU',
  alexMercerAlt: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDwVIbTgahtkD8kWGHZRge66BSTBnr-aanIL8cbz-3PHmK8M3xoFEft71hnV_e27SL_bd-Owy5OQBvEwmmrJ9bBa2Pcu7yk56XRix4Oj0mUjZKv2yd3kCBfSLFQoKOcYaiwd5uZTOpzYKDLXuvONW6IQ3wEVvm8N3YoiT8wxnzMXfh2erjcptap28sEGJ7C0FKwnqvNPKVn4LvOpgIbRNee4UTvxV7I7c5MfNNrCJao_Rft_VUS7xWVaF5QsAU0ehlxawRGJsea5lE',
  eleanorVance: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAYbSHi1KlUnN8KSsNmuxZjswv9Tk7mT0qAlo5lTUDQbA3PfLvG7j7UJtb3V-KnOmcLk1DjvI7PuRUa7DMFsZlMvMt3C9gVz1YGvSMPc6wu34mV2m__ytzL9ShJbzMdcYNml0fLoakAk4CMJlaQDtrl64TzM5XAFxpJRMt242QfcMM9KTyPtobNwosbithHqagyhw-a-RjM-AwpzLglyP-CvuB_teykkGKv9yAu2H6OSczAktcFQ_bI_H7ie84ZD6v4M-61SdZn_9s',
  suburbanMap: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBLk8IW35xlU0Ox3LxE4JzJmfjEOMXd_IpPL5tWM605KcN-AykiGUBQ3zIY_-eMd0M-Hrlz4eHp_QA4bGHGMgV9iHyfScwfZgJ9afvus22_AOjjVvHhoYs1b-_9wOqq2CMGc784AEuUDLeb7bBrKsE5xZWZLvl23WPYl1UOC5mFAC47bFAPEfv2Ms9VALSHEumfrK8c7U-wrb51pg3hEpWN_WFGwx4wIlQlD_qnI66AOp_9ZmUtMx9vWX1Y76Etn7PlNGjGcwOjecw',
  routeMap: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC3jbpxYi3odqhAxMxyVm_Rgb3j8fQzv3OMxpP0Z4lU-zx_ikIavFd76KlRzkf7kqgWY8dR1hjghg7qRJrK12bLmAk84FLc76yd06jRLtQ7qbnlz4L_4rNQqtMsFozgJezM8UJ0lhjZPqolqLfPYJqdKViNPLs7fv03sxmEl6AWKxm62uXw7Dp7TYeNKipZSoT3QIDL9nQKbnU36BRGJkL8DFRs3UBk0JGFb12lyQiqKFoP-t0GaLuaeyTtUBBx1TBDuHu49c90Q4E',
  kitchenInterior: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBc_EyCJ39DqGqY-st_u_UliuXPSsLxRknD0OQD4MhvVhjPed5rgHpD-7hCc19EaJVYEeP5d7g5iGUUOgWvkrst-fyC08rJpiwqesGtyzOjogfb7Kz9SCF-gjkWqu5IeW_SItMhAfuUav0Xb14kRJj2740kWJl7u3Tu30ho7dB0geOO7roNxtjgnwfuk2TxTLSYQCY4ZKSTLSNLBw3ICFwK5WDPuCqIY9r6lUb5Ki9VT4badoF1aZzT_OclIclb5y5m6tuqqR13jQQ',
};

export const RECOMMENDED_TECHNICIANS: Technician[] = [
  {
    name: 'Sarah Jenkins',
    avatar: IMAGE_URLS.femaleTechSarah,
    rating: 4.9,
    reviewsCount: 124,
    specialty: 'Deep Cleaning Expert',
    ratePerHour: 45
  },
  {
    name: 'Michael Chen',
    avatar: IMAGE_URLS.maleTechMichael,
    rating: 4.8,
    reviewsCount: 89,
    specialty: 'Master Plumber',
    ratePerHour: 60
  }
];

export const INITIAL_MESSAGES: Message[] = [
  {
    id: 'm1',
    sender: 'system',
    senderName: 'System',
    content: 'System: Connecting regarding Job ID: #8849-AC',
    timestamp: '10:41 AM'
  },
  {
    id: 'm2',
    sender: 'technician',
    senderName: 'Alex Mercer',
    senderAvatar: IMAGE_URLS.alexMercerAlt,
    content: "I've arrived at the location but the gate code provided isn't working.",
    timestamp: '10:42 AM'
  },
  {
    id: 'm3',
    sender: 'support',
    senderName: 'Sarah',
    senderAvatar: IMAGE_URLS.supportSarahAlt,
    content: 'Checking with the customer now, please stand by.',
    timestamp: '10:43 AM'
  }
];

export const INITIAL_JOBS: Job[] = [
  {
    id: '#8849-AC',
    serviceType: 'Deep Cleaning',
    serviceCategory: 'cleaning',
    customerName: 'Sarah Jenkins',
    customerPhone: '555-0199',
    customerAvatar: IMAGE_URLS.femaleTechSarah,
    address: '123 Maple Street',
    apartment: 'Apt 4B',
    city: 'Seattle',
    zipCode: '98101',
    date: '2026-07-02',
    timeSlot: 'morning',
    rooms: '3-4',
    duration: 2,
    focusAreas: ['Kitchen Appliances inside', 'Deep Bathroom Scrub'],
    notes: 'Please focus on the kitchen grout and the master bathroom.',
    status: 'on_the_way',
    baseRate: 45,
    tax: 3.5,
    travelFee: 10,
    addOnsPrice: 0,
    totalPrice: 100,
    elapsedTime: 6372,
    checklist: [
      { text: 'Living Room Dusting & Vacuuming', completed: true },
      { text: 'Kitchen Countertops & Sink', completed: true },
      { text: 'Bathroom Scrubbing', completed: false },
      { text: 'Interior Window Cleaning', completed: false }
    ],
    materials: [
      { name: 'Filter 20x20x1', quantity: 2 },
      { name: 'Motor Belt (B-45)', quantity: 1 }
    ]
  },
  {
    id: '#8472-HV',
    serviceType: 'HVAC Maintenance',
    serviceCategory: 'electrical',
    customerName: 'Eleanor Vance',
    customerPhone: '555-0210',
    customerAvatar: IMAGE_URLS.eleanorVance,
    address: '1248 Hill House Lane',
    apartment: '',
    city: 'North Suburbs',
    zipCode: '90210',
    date: '2026-07-01',
    timeSlot: 'afternoon',
    rooms: '5-6',
    duration: 4,
    focusAreas: ['Filter inspection', 'System check'],
    notes: 'AC has been making a whistling noise lately.',
    status: 'in_progress',
    baseRate: 120,
    tax: 10.2,
    travelFee: 20,
    addOnsPrice: 45,
    totalPrice: 245,
    elapsedTime: 9900,
    checklist: [
      { text: 'Completed full system inspection and cleaned primary filters', completed: true },
      { text: 'Replaced worn out blower motor belt (Part #B-45)', completed: true },
      { text: 'Verify refrigerant levels are optimal', completed: false }
    ],
    materials: [
      { name: 'Filter 20x20x1', quantity: 2 },
      { name: 'Motor Belt (B-45)', quantity: 1 }
    ]
  }
];
