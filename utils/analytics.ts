import { Document, Model } from "mongoose";

interface MonthData {
    month: string;
    count: number;
}

export async function generateLast12MonthData<T extends Document> (
    model: Model<T>
): Promise<{last12Months: MonthData[]}> {
    const last12Months: MonthData[] = [];
    const currentDate = new Date();
    currentDate.setDate(currentDate.getDate() + 1);

    for (let i=11; i>=0; i--) {
        // const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()-i*28);
        // const startDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()-28);
        // const monthYear = endDate.toLocaleString('default', {day: "numeric", month:"short", year:"numeric"});
        // Tạo ngày đầu tháng
        const startOfMonth = new Date(
            currentDate.getFullYear(),
            currentDate.getMonth() - i,
            1,
            0, 0, 0
        );
        
        // Tạo ngày cuối tháng
        const endOfMonth = new Date(
            currentDate.getFullYear(),
            currentDate.getMonth() - i + 1,
            0,
            23, 59, 59
        );

        // Format tên tháng (ví dụ: "Jan 2024")
        const monthName = startOfMonth.toLocaleString('default', {
            month: 'short'
        });
        const year = startOfMonth.getFullYear();
        const monthYear = `${monthName} ${year}`;
        const count = await model.countDocuments({
            createdAt: {
                $gte: startOfMonth, // startDate,
                $lt: endOfMonth //endDate,
            },
        });
        last12Months.push({month: monthYear, count});
    };
    return {last12Months};
}