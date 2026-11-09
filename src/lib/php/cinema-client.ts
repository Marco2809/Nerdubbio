import { api } from '@/lib/php/client';

export interface CinemaCity {
  slug: string;
  name: string;
}

export interface CinemaOption {
  id: string;
  slug: string;
  name: string;
}

export interface MyCinema {
  id: string;
  city: string;
  name: string;
  read_at: string | null;
}

/** Un cinema dentro la giornata di un film: orari già ordinati. */
export interface CinemaShowRow {
  id: string;
  name: string;
  times: string[];
  hall: string;
  price: string;
}

export interface CinemaFilm {
  title: string;
  cinemas: CinemaShowRow[];
}

export interface CinemaDay {
  day: string;
  films: CinemaFilm[];
}

export interface MyCinemasResult {
  cinemas: MyCinema[];
  max: number;
  days: CinemaDay[];
}

export const cinemaApi = {
  cities(): Promise<{ cities: CinemaCity[] }> {
    return api('/api/cinema.php?action=cities');
  },
  list(city: string): Promise<{ cinemas: CinemaOption[] }> {
    return api(`/api/cinema.php?action=list&city=${encodeURIComponent(city)}`);
  },
  mine(): Promise<MyCinemasResult> {
    return api('/api/cinema.php?action=mine');
  },
  /** Aggiunge o toglie un cinema. La prima volta legge anche gli orari: può volerci qualche secondo. */
  toggle(city: string, id: string): Promise<MyCinemasResult> {
    return api('/api/cinema.php?action=toggle', 'POST', { city, id });
  },
};
