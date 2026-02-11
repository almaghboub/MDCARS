import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useI18n } from "@/lib/i18n";
import { Settings as SettingsIcon, Users, Plus, Pencil, Trash2, Key, Shield, Globe } from "lucide-react";
import type { User } from "@shared/schema";

const userFormSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  role: z.enum(["owner", "cashier", "stock_manager"]),
});

const passwordFormSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Confirm password is required"),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type UserFormData = z.infer<typeof userFormSchema>;

export default function Settings() {
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const { toast } = useToast();
  const { t, lang, setLang } = useI18n();

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const userForm = useForm<UserFormData>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      username: "",
      password: "",
      firstName: "",
      lastName: "",
      role: "cashier",
    },
  });

  const passwordForm = useForm<z.infer<typeof passwordFormSchema>>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: UserFormData) => {
      const res = await apiRequest("POST", "/api/users", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: t("userCreated") });
      setIsUserDialogOpen(false);
      userForm.reset();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<UserFormData> }) => {
      const res = await apiRequest("PATCH", `/api/users/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: t("userUpdated") });
      setIsUserDialogOpen(false);
      setEditingUser(null);
      userForm.reset();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: t("userDeleted") });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: z.infer<typeof passwordFormSchema>) => {
      const res = await apiRequest("POST", "/api/auth/change-password", {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("passwordChanged") });
      setIsPasswordDialogOpen(false);
      passwordForm.reset();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    userForm.reset({
      username: user.username,
      password: "",
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role as any,
    });
    setIsUserDialogOpen(true);
  };

  const onUserSubmit = (data: UserFormData) => {
    if (editingUser) {
      const updateData: Partial<UserFormData> = {
        username: data.username,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
      };
      if (data.password) {
        updateData.password = data.password;
      }
      updateUserMutation.mutate({ id: editingUser.id, data: updateData });
    } else {
      createUserMutation.mutate(data);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "owner":
        return <Badge className="bg-purple-600">{t("owner")}</Badge>;
      case "cashier":
        return <Badge className="bg-blue-600">{t("cashier")}</Badge>;
      case "stock_manager":
        return <Badge className="bg-green-600">{t("stockManager")}</Badge>;
      default:
        return <Badge>{role}</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-settings-title">{t("settings")}</h1>
          <p className="text-muted-foreground">{t("manageSettings")}</p>
        </div>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">{t("userManagement")}</TabsTrigger>
          <TabsTrigger value="security">{t("security")}</TabsTrigger>
          <TabsTrigger value="system">{t("systemInfo")}</TabsTrigger>
          <TabsTrigger value="language">{t("language")}</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  {t("users")} ({users.length})
                </CardTitle>
                <Dialog open={isUserDialogOpen} onOpenChange={(open) => {
                  setIsUserDialogOpen(open);
                  if (!open) {
                    setEditingUser(null);
                    userForm.reset();
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-user">
                      <Plus className="w-4 h-4 mr-2" />
                      {t("addUser")}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingUser ? t("editUser") : t("addUser")}</DialogTitle>
                    </DialogHeader>
                    <Form {...userForm}>
                      <form onSubmit={userForm.handleSubmit(onUserSubmit)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <FormField control={userForm.control} name="firstName" render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("firstName")}</FormLabel>
                              <FormControl><Input {...field} data-testid="input-user-firstname" /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={userForm.control} name="lastName" render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("lastName")}</FormLabel>
                              <FormControl><Input {...field} data-testid="input-user-lastname" /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </div>
                        <FormField control={userForm.control} name="username" render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("username")}</FormLabel>
                            <FormControl><Input {...field} data-testid="input-user-username" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={userForm.control} name="password" render={({ field }) => (
                          <FormItem>
                            <FormLabel>{editingUser ? t("newPasswordLeaveBlank") : t("password")}</FormLabel>
                            <FormControl><Input type="password" {...field} data-testid="input-user-password" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={userForm.control} name="role" render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("role")}</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-user-role">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="owner">{t("ownerFullAccess")}</SelectItem>
                                <SelectItem value="cashier">{t("cashierSalesOnly")}</SelectItem>
                                <SelectItem value="stock_manager">{t("stockManagerInventory")}</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <Button type="submit" className="w-full" disabled={createUserMutation.isPending || updateUserMutation.isPending} data-testid="button-save-user">
                          {createUserMutation.isPending || updateUserMutation.isPending ? t("saving") : editingUser ? t("updateUser") : t("addUser")}
                        </Button>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p>{t("loading")}</p>
              ) : users.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">{t("noUsersFound")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("name")}</TableHead>
                      <TableHead>{t("username")}</TableHead>
                      <TableHead>{t("role")}</TableHead>
                      <TableHead>{t("status")}</TableHead>
                      <TableHead>{t("actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id} data-testid={`user-row-${user.id}`}>
                        <TableCell className="font-medium">{user.firstName} {user.lastName}</TableCell>
                        <TableCell>{user.username}</TableCell>
                        <TableCell>{getRoleBadge(user.role)}</TableCell>
                        <TableCell>
                          <Badge variant={user.isActive ? "secondary" : "destructive"}>
                            {user.isActive ? t("active") : t("inactive")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => handleEditUser(user)} data-testid={`button-edit-user-${user.id}`}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            {user.username !== "admin" && (
                              <Button variant="ghost" size="sm" onClick={() => deleteUserMutation.mutate(user.id)} data-testid={`button-delete-user-${user.id}`}>
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5" />
                {t("changePassword")}
              </CardTitle>
              <CardDescription>{t("updatePassword")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-change-password">
                    <Key className="w-4 h-4 mr-2" />
                    {t("changePassword")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("changePassword")}</DialogTitle>
                  </DialogHeader>
                  <Form {...passwordForm}>
                    <form onSubmit={passwordForm.handleSubmit((data) => changePasswordMutation.mutate(data))} className="space-y-4">
                      <FormField control={passwordForm.control} name="currentPassword" render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("currentPassword")}</FormLabel>
                          <FormControl><Input type="password" {...field} data-testid="input-current-password" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={passwordForm.control} name="newPassword" render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("newPassword")}</FormLabel>
                          <FormControl><Input type="password" {...field} data-testid="input-new-password" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={passwordForm.control} name="confirmPassword" render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("confirmPassword")}</FormLabel>
                          <FormControl><Input type="password" {...field} data-testid="input-confirm-password" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <Button type="submit" className="w-full" disabled={changePasswordMutation.isPending}>
                        {changePasswordMutation.isPending ? t("changing") : t("changePassword")}
                      </Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                {t("rolePermissions")}
              </CardTitle>
              <CardDescription>{t("overviewAccessLevels")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-purple-600">{t("owner")}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{t("ownerDesc")}</p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-blue-600">{t("cashier")}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{t("cashierDesc")}</p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-green-600">{t("stockManager")}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{t("stockManagerDesc")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon className="w-5 h-5" />
                {t("systemInformation")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">{t("application")}</p>
                    <p className="font-medium">MD CARS</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">{t("version")}</p>
                    <p className="font-medium">1.0.0</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">{t("currencySupport")}</p>
                    <p className="font-medium">LYD / USD</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">{t("database")}</p>
                    <p className="font-medium">PostgreSQL</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="language" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                {t("language")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Button
                  variant={lang === "en" ? "default" : "outline"}
                  onClick={() => setLang("en")}
                  data-testid="button-lang-en"
                >
                  {t("english")}
                </Button>
                <Button
                  variant={lang === "ar" ? "default" : "outline"}
                  onClick={() => setLang("ar")}
                  data-testid="button-lang-ar"
                >
                  {t("arabic")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
